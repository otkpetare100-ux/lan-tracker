const express    = require('express');
const fetch      = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path       = require('path');
const { MongoClient } = require('mongodb');

try { require('dotenv').config(); } catch(e) {}
const { initBot, notifyRankChange, sendDailySummary, notifyBetResults, notifyRemake, notifyChallengeComplete } = require('./bot.js');

const app      = express();
const PORT     = process.env.PORT || 3000;
const API_KEY  = process.env.RIOT_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

if (!API_KEY)   { console.error('❌ Falta RIOT_API_KEY');  process.exit(1); }
if (!MONGO_URI) { console.error('❌ Falta MONGO_URI');     process.exit(1); }

// Conexión a MongoDB con reintentos
let db;
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    await client.connect();
    db = client.db('lan-tracker');
    console.log('✅ MongoDB conectado');
    
    // Crear índices para mejor rendimiento
    await db.collection('accounts').createIndex({ puuid: 1 }, { unique: true });
    await db.collection('accounts').createIndex({ addedAt: -1 });
    
    // Índices para historial de rangos
    await db.collection('rank_history').createIndex({ puuid: 1 });
    await db.collection('rank_history').createIndex({ date: -1 });

    // Índices para Torneos
    await db.collection('tournaments').createIndex({ status: 1 });
    await db.collection('tournaments').createIndex({ date: -1 });

    // Índices para Actividad y Retos
    await db.collection('activities').createIndex({ accountId: 1 });
    await db.collection('activities').createIndex({ timestamp: -1 });
    await db.collection('challenges').createIndex({ status: 1 });

    // Inicializar Bot de Discord
    initBot(db);

    // Resumen Diario cada 24h
    setInterval(() => sendDailySummary(db), 24 * 60 * 60 * 1000);

    // Recordatorio de Primera Victoria (9 AM)
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        sendDailyMotivation(db);
      }
    }, 60 * 1000);

    // Escaneo de Partidas en Vivo cada 5 min
    const liveCache = new Set();
    setInterval(async () => {
      try {
        const accounts = await db.collection('accounts').find({}).toArray();
        for (const acc of accounts) {
          const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${acc.puuid}?api_key=${process.env.RIOT_API_KEY}`;
          const res = await fetch(url);
          if (res.ok) {
            if (!liveCache.has(acc.puuid)) {
              liveCache.add(acc.puuid);
              notifyLiveGame(acc, { championName: '?' });
            }
          } else {
            // Si estaba en cache y ya no, es que terminó la partida
            if (liveCache.has(acc.puuid)) {
              liveCache.delete(acc.puuid);
              settleBets(acc); // Iniciar liquidación
            }
          }
        }
      } catch(e) {}
    }, 5 * 60 * 1000);
  } catch(e) {
    console.error('❌ Error conectando a MongoDB:', e);
    console.log('Reintentando en 5 segundos...');
    setTimeout(connectDB, 5000);
  }
}
// Función para liquidar apuestas
async function settleBets(acc) {
  try {
    // 1. Esperar a que la API actualice el historial (60 seg)
    console.log(`[Bets] Procesando resultados para ${acc.gameName}...`);
    await new Promise(r => setTimeout(r, 60000));

    // 2. Obtener el resultado de la última partida
    const matchUrl = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${acc.puuid}/ids?count=1&api_key=${API_KEY}`;
    const matchIdsRes = await fetch(matchUrl);
    const matchIds = await matchIdsRes.json();
    
    if (!matchIds || matchIds.length === 0) return;

    const detailUrl = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchIds[0]}?api_key=${API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const match = await detailRes.json();
    
    const p = match.info.participants.find(x => x.puuid === acc.puuid);
    if (!p) return;

    // --- Funcionalidad: Seguro contra Remake (< 3.5 min) ---
    const isRemake = match.info.gameDuration < 210;
    
    if (isRemake) {
      console.log(`[Bets] Remake detectado para ${acc.gameName}. Devolviendo apuestas...`);
      const allBets = await db.collection('bets').find({ 
        targetPuuid: acc.puuid, 
        status: 'open' 
      }).toArray();

      for (const bet of allBets) {
        await db.collection('economy').updateOne(
          { discordId: bet.discordId },
          { $inc: { coins: bet.amount } }
        );
        await db.collection('bets').updateOne({ _id: bet._id }, { $set: { status: 'refunded' } });
      }
      
      notifyRemake(`${acc.gameName}#${acc.tagLine}`);
      return;
    }

    const gameResult = p.win ? 'gana' : 'pierde';
    
    // 3. Buscar apuestas abiertas
    const openBets = await db.collection('bets').find({ 
      targetPuuid: acc.puuid, 
      status: 'open' 
    }).toArray();

    if (openBets.length === 0) return;

    const winners = [];
    for (const bet of openBets) {
      if (bet.choice === gameResult) {
        // Pagar usando el multiplicador guardado (o 2x por defecto)
        const multiplier = bet.multiplier || 2.0;
        const prize = Math.floor(bet.amount * multiplier);

        await db.collection('economy').updateOne(
          { discordId: bet.discordId },
          { $inc: { coins: prize } }
        );
        winners.push(bet);
        await db.collection('bets').updateOne({ _id: bet._id }, { $set: { status: 'won' } });
      } else {
        await db.collection('bets').updateOne({ _id: bet._id }, { $set: { status: 'lost' } });
      }
    }

    // 4. Notificar en Discord
    notifyBetResults(`${acc.gameName}#${acc.tagLine}`, gameResult, winners);

    // --- NUEVO: Motor de Retos Automáticos ---
    await checkChallenges(acc, match);

  } catch (e) {
    console.error('[Bets Error]', e);
  }
}

// --- Motor de Retos Automáticos ---
async function checkChallenges(acc, match) {
  try {
    const participant = match.info.participants.find(p => p.puuid === acc.puuid);
    if (!participant) return;

    const challengesFound = [];
    let totalCoins = 0;

    // 1. Reto: Pentakill (El Santo Grial)
    if (participant.pentakills > 0) {
      challengesFound.push('🏆 PENTAKILL (Legendario)');
      totalCoins += 1000;
    }

    // 2. Reto: El Carnicero (15+ Kills)
    if (participant.kills >= 15) {
      challengesFound.push('🔪 El Carnicero (Épico)');
      totalCoins += 200;
    }

    // 3. Reto: Inmortal (0 muertes y victoria)
    if (participant.deaths === 0 && participant.win) {
      challengesFound.push('😇 Inmortal (Raro)');
      totalCoins += 150;
    }

    // 4. Reto: Farm Machine (8+ CS/min)
    const csPerMin = (participant.totalMinionsKilled + participant.neutralMinionsKilled) / (match.info.gameDuration / 60);
    if (csPerMin >= 8.5 && match.info.gameDuration > 1200) {
      challengesFound.push('🚜 Farm Machine (Raro)');
      totalCoins += 100;
    }

    if (challengesFound.length > 0) {
      // Pagar monedas en la colección de economía
      await db.collection('economy').updateOne(
        { discordId: acc.discordId },
        { $inc: { coins: totalCoins } },
        { upsert: true }
      );

      // Guardar el registro de actividad para la web
      await db.collection('activities').insertOne({
        accountId: acc.puuid,
        type: 'challenge_win',
        message: `🏆 ¡${acc.gameName} ha superado ${challengesFound.length} retos! (+${totalCoins} coins)`,
        timestamp: new Date()
      });

      // Notificar por Bot
      notifyChallengeComplete(acc.gameName, challengesFound, totalCoins);
    }
  } catch (e) {
    console.error('Error procesando retos:', e);
  }
}

connectDB();

function getCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('accounts');
}

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
app.use(express.json({ limit: '10mb' }));

// Sirve los archivos de la raíz
app.use(express.static(path.join(__dirname)));

// Sirve carpetas específicas
app.use('/ranks', express.static(path.join(__dirname, 'ranks')));
app.use('/pic', express.static(path.join(__dirname, 'pic')));

// -------------------------------------------

// ---- Middleware de verificación de DB ----
app.use('/accounts', (req, res, next) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not ready' });
  }
  next();
});

// ---- Endpoints de cuentas ----

app.get('/accounts', async (req, res) => {
  try {
    const accounts = await getCollection()
      .find({})
      .sort({ addedAt: -1 })
      .toArray();
    res.json(accounts);
  } catch(e) {
    console.error('Error leyendo cuentas:', e);
    res.status(500).json({ error: 'Error leyendo cuentas' });
  }
});

app.post('/accounts', async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.puuid) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const exists = await getCollection().findOne({ puuid: entry.puuid });
    if (exists) return res.status(409).json({ error: 'Ya existe', added: false });
    await getCollection().insertOne(entry);
    res.json({ ok: true, added: true });
  } catch(e) {
    console.error('Error guardando cuenta:', e);
    res.status(500).json({ error: 'Error guardando cuenta' });
  }
});

app.delete('/accounts/:puuid', async (req, res) => {
  try {
    const result = await getCollection().deleteOne({ puuid: req.params.puuid });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.json({ ok: true });
  } catch(e) {
    console.error('Error eliminando cuenta:', e);
    res.status(500).json({ error: 'Error eliminando cuenta' });
  }
});

app.put('/accounts/:puuid', async (req, res) => {
  try {
    const result = await getCollection().replaceOne(
      { puuid: req.params.puuid },
      req.body
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.json({ ok: true });
  } catch(e) {
    console.error('Error actualizando cuenta:', e);
    res.status(500).json({ error: 'Error actualizando cuenta' });
  }
});

// ---- Funcionalidad 2: Reacciones (Social) ----
app.post('/accounts/:puuid/react', async (req, res) => {
  const { emoji, userId } = req.body;
  const { puuid } = req.params;

  if (!emoji || !userId) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const acc = await getCollection().findOne({ puuid });
    if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const currentReactions = (acc.reactions && acc.reactions[emoji]) || [];
    const hasReacted = currentReactions.includes(userId);

    const update = hasReacted 
      ? { $pull: { [`reactions.${emoji}`]: userId } }
      : { $addToSet: { [`reactions.${emoji}`]: userId } };

    await getCollection().updateOne({ puuid }, update);
    res.json({ ok: true, reacted: !hasReacted });
  } catch(e) {
    console.error('Error en reacción:', e);
    res.status(500).json({ error: 'Error procesando reacción' });
  }
});

// ---- Proxy de Riot API ----
app.get('/riot', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Falta ?url=' });

  const allowed = ['americas.api.riotgames.com', 'la1.api.riotgames.com', 'la2.api.riotgames.com'];
  if (!allowed.some(d => targetUrl.includes(d))) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    const sep     = targetUrl.includes('?') ? '&' : '?';
    const riotRes = await fetch(`${targetUrl}${sep}api_key=${API_KEY}`);
    const data    = await riotRes.json();
    res.status(riotRes.status).json(data);
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ error: 'Error contactando Riot' });
  }
});

// ---- Historial de Rangos ----
app.post('/rank-history', async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.puuid || !entry.rank) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    entry.date = new Date().toISOString();
    await db.collection('rank_history').insertOne(entry);

    // Notificar a Discord si hay cambio relevante
    if (entry.discordNotify) {
      notifyRankChange({
        name: entry.gameName,
        oldRank: entry.oldRank,
        newRank: `${entry.rank.tier} ${entry.rank.division}`,
        promoted: entry.promoted
      });
    }

    // ---- Funcionalidad 1: Feed de Actividad ----
    const activityLogs = [];
    if (entry.oldRank && entry.oldRank !== `${entry.rank.tier} ${entry.rank.division}`) {
      activityLogs.push({
        accountId: entry.puuid,
        type: 'level_up',
        message: `¡${entry.gameName} ha cambiado de rango a ${entry.rank.tier} ${entry.rank.division}!`,
        timestamp: new Date()
      });
    }
    
    // Racha negativa (detectada si viene en el body)
    if (entry.streak <= -3) {
      activityLogs.push({
        accountId: entry.puuid,
        type: 'lose_streak',
        message: `${entry.gameName} está en una racha de ${Math.abs(entry.streak)} derrotas. ¡Ánimo!`,
        timestamp: new Date()
      });
    }

    if (activityLogs.length > 0) {
      await db.collection('activities').insertMany(activityLogs);
    }

    // ---- Funcionalidad 3: Sistema de Retos ----
    const activeChallenges = await db.collection('challenges').find({ 
      participants: entry.puuid,
      status: 'active' 
    }).toArray();

    for (const challenge of activeChallenges) {
      // Ejemplo: Reto de 'Carrera a Platinum'
      if (challenge.goalTier === entry.rank.tier || 
         (challenge.type === 'race' && entry.rank.tier === 'PLATINUM')) {
        await db.collection('challenges').updateOne(
          { _id: challenge._id },
          { $set: { status: 'completed', winner: entry.puuid, completedAt: new Date() } }
        );
        
        await db.collection('activities').insertOne({
          accountId: entry.puuid,
          type: 'challenge_win',
          message: `🏆 ¡${entry.gameName} ha completado el reto: ${challenge.name}!`,
          timestamp: new Date()
        });
      }
    }

    res.json({ ok: true });
  } catch(e) {
    console.error('Error guardando historial de rango:', e);
    res.status(500).json({ error: 'Error guardando historial' });
  }
});

// ---- Feed de Actividad ----
app.get('/activities', async (req, res) => {
  try {
    const logs = await db.collection('activities')
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    res.json(logs);
  } catch(e) {
    res.status(500).json({ error: 'Error cargando actividad' });
  }
});

app.get('/rank-history/:puuid', async (req, res) => {
  try {
    const history = await db.collection('rank_history')
      .find({ puuid: req.params.puuid })
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    res.json(history);
  } catch(e) {
    console.error('Error obteniendo historial de rango:', e);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// ---- Gestión de Torneos ----
app.get('/tournaments', async (req, res) => {
  try {
    const list = await db.collection('tournaments').find({}).sort({ date: -1 }).toArray();
    res.json(list);
  } catch(e) {
    res.status(500).json({ error: 'Error leyendo torneos' });
  }
});

app.post('/tournaments', async (req, res) => {
  try {
    const tournament = req.body;
    tournament.createdAt = new Date().toISOString();
    const result = await db.collection('tournaments').insertOne(tournament);
    res.json({ ok: true, id: result.insertedId });
  } catch(e) {
    res.status(500).json({ error: 'Error creando torneo' });
  }
});

app.put('/tournaments/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const update = { ...req.body };
    delete update._id;
    await db.collection('tournaments').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error actualizando torneo' });
  }
});

app.delete('/tournaments/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    await db.collection('tournaments').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error eliminando torneo' });
  }
});

// ---- Gestión de Historial de Splits (Hall of Fame) ----
app.get('/splits', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'DB no lista' });
    const list = await db.collection('splits').find({}).sort({ date: -1 }).toArray();
    res.json(list);
  } catch(e) {
    res.status(500).json({ error: 'Error leyendo historial de splits' });
  }
});

app.post('/splits/archive', async (req, res) => {
  const { name, key } = req.body;
  if (!name) return res.status(400).json({ error: 'Falta el nombre del Split' });
  if (key !== process.env.ADMIN_WEB_KEY) return res.status(401).json({ error: 'Clave de administrador incorrecta' });

  try {
    const accounts = await db.collection('accounts').find({}).toArray();
    
    // Función de puntuación interna para el archivado
    const getScore = (acc) => {
      const TIER_VALS = { CHALLENGER: 9, GRANDMASTER: 8, MASTER: 7, DIAMOND: 6, EMERALD: 5, PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1, IRON: 0 };
      const DIV_VALS  = { I: 4, II: 3, III: 2, IV: 1 };
      const soloQ = acc.soloQ;
      if (!soloQ) return -1;
      return (TIER_VALS[soloQ.tier] ?? -1) * 10000 + (DIV_VALS[soloQ.rank] ?? 0) * 1000 + (soloQ.leaguePoints || 0);
    };

    const sorted = accounts.sort((a,b) => getScore(b) - getScore(a));

    const archiveEntry = {
      name: name,
      date: new Date(),
      rankings: sorted.map(a => ({
        gameName: a.gameName,
        tagLine: a.tagLine,
        tier: a.soloQ?.tier || 'UNRANKED',
        rank: a.soloQ?.rank || '',
        lp: a.soloQ?.leaguePoints || 0,
        profileIconId: a.profileIconId
      }))
    };

    await db.collection('splits').insertOne(archiveEntry);
    res.json({ ok: true, message: `Split '${name}' archivado correctamente` });
  } catch(e) {
    console.error('Error archivando split:', e);
    res.status(500).json({ error: 'Error al archivar el split' });
  }
});

// ---- Perfil Público (Compartir) ----
app.get('/player/:slug', async (req, res) => {
  try {
    const parts = req.params.slug.split('-');
    if (parts.length < 2) return res.status(400).send('URL invÃ¡lida');
    const tagLine = parts.pop();
    const gameName = parts.join('-');
    if (!gameName || !tagLine) return res.status(400).send('URL inválida');

    const acc = await db.collection('accounts').findOne({ 
      gameName: { $regex: new RegExp(`^${gameName}$`, 'i') },
      tagLine: { $regex: new RegExp(`^${tagLine}$`, 'i') }
    });

    if (!acc) return res.status(404).send('Jugador no encontrado en LAN Tracker');

    const tier = acc.soloQ ? acc.soloQ.tier : 'UNRANKED';
    const rankStr = tier === 'UNRANKED' ? 'Unranked' : `${tier} ${acc.soloQ.rank || ''} - ${acc.soloQ.leaguePoints || 0} LP`;
    const wr = acc.soloQ && acc.soloQ.wins ? Math.round((acc.soloQ.wins / (acc.soloQ.wins + acc.soloQ.losses)) * 100) : null;
    const wrStr = wr !== null ? `${wr}% Winrate` : 'Sin partidas';

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${acc.gameName}#${acc.tagLine} - LAN Tracker</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #070810; color: #f2f4ff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: rgba(23, 28, 48, 0.92); border: 1px solid rgba(255,255,255,0.08); padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h1 { margin: 0 0 10px 0; color: #d77aa8; font-size: 2rem; }
        .tag { color: #657099; font-size: 1.2rem; font-weight: normal; }
        .level { color: #9d6cff; font-weight: bold; margin-bottom: 20px; display: block; }
        .stats { display: flex; justify-content: space-around; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-top: 20px; }
        .stat-box { display: flex; flex-direction: column; padding: 0 15px;}
        .stat-label { font-size: 0.8rem; color: #9aa3c7; text-transform: uppercase; margin-bottom: 5px; }
        .stat-value { font-size: 1.2rem; font-weight: bold; color: #f2f4ff; }
        .watermark { position: fixed; bottom: 20px; opacity: 0.5; font-size: 0.9rem; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${acc.gameName}<span class="tag">#${acc.tagLine}</span></h1>
        <span class="level">Nivel ${acc.summonerLevel}</span>
        
        <div class="stats">
          <div class="stat-box">
            <span class="stat-label">Rango</span>
            <span class="stat-value">${rankStr}</span>
          </div>
          <div class="stat-box" style="border-left: 1px solid rgba(255,255,255,0.1);">
            <span class="stat-label">Rendimiento</span>
            <span class="stat-value">${wrStr}</span>
          </div>
        </div>
      </div>
      <div class="watermark">LAN TRACKER</div>
    </body>
    </html>
    `;
    res.send(html);
  } catch(e) {
    console.error('Error sirviendo perfil:', e);
    res.status(500).send('Error interno');
  }
});

app.delete('/splits/last', async (req, res) => {
  const { key } = req.body;
  if (key !== process.env.ADMIN_WEB_KEY) return res.status(401).json({ error: 'Clave de administrador incorrecta' });

  try {
    const lastSplit = await db.collection('splits').find({}).sort({ date: -1 }).limit(1).toArray();
    if (lastSplit.length === 0) return res.status(404).json({ error: 'No hay splits para borrar' });

    await db.collection('splits').deleteOne({ _id: lastSplit[0]._id });
    res.json({ ok: true, message: 'Ãšltimo split borrado correctamente' });
  } catch(e) {
    res.status(500).json({ error: 'Error al borrar el split' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n✅ LAN Tracker corriendo en puerto ${PORT}\n`);
});