const liveCache = new Set();
const express    = require('express');
const fetch      = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path       = require('path');
const { MongoClient } = require('mongodb');

try { require('dotenv').config(); } catch(e) {}
const { initBot, notifyRankChange, notifyLiveGame, sendDailySummary, notifyBetResults, notifyRemake, notifyChallengeComplete, GACHA_ITEMS } = require('./bot.js');

// ---- Configuración y Variables Globales ----
let DDRAGON_VERSION = '15.8.1'; 

// Función para obtener la versión más reciente de Data Dragon
async function updateDDragonVersion() {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    if (versions && versions.length > 0) {
      DDRAGON_VERSION = versions[0];
      console.log(`[DDragon] Versión actualizada: ${DDRAGON_VERSION}`);
    }
  } catch (e) {
    console.error('[DDragon] Error al actualizar versión:', e);
  }
}
updateDDragonVersion();
// Actualizar cada 24 horas
setInterval(updateDDragonVersion, 1000 * 60 * 60 * 24);

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

    // --- Sistema de Notificaciones Periódicas ---
    setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // 1. Recordatorio matutino (Ahora a las 12:00 PM)
      if (hour === 12 && minute === 0) {
        sendDailyMotivation(db);
      }

      // 2. Resumen de la Perrera cada 4h (Solo de 9:00 AM a 10:00 PM)
      // Horas: 9:00, 13:00, 17:00, 21:00
      const summaryHours = [9, 13, 17, 21];
      if (summaryHours.includes(hour) && minute === 0) {
        sendDailySummary(db);
      }
    }, 60 * 1000);

    // --- Monitor de Vencimiento de API Key (Riot Dev Key = 24h) ---
    setInterval(async () => {
      try {
        const config = await db.collection('system_config').findOne({ key: 'riot_api_status' });
        const currentKey = process.env.RIOT_API_KEY;
        const now = new Date();

        if (!config || config.api_key_value !== currentKey) {
          await db.collection('system_config').updateOne(
            { key: 'riot_api_status' },
            { $set: { api_key_value: currentKey, updated_at: now, notified: false } },
            { upsert: true }
          );
        } else if (!config.notified) {
          const diffMs = now - new Date(config.updated_at);
          const diffMin = Math.floor(diffMs / (1000 * 60));
          if (diffMin >= 1439) {
            await notifyAdmin('⚠️ **RECORDATORIO:** Tu API Key de Riot vencerá en **1 minuto**. ¡Renuévala!');
            await db.collection('system_config').updateOne(
              { key: 'riot_api_status' },
              { $set: { notified: true } }
            );
          }
        }
      } catch (e) { console.error('[API Monitor Error]', e); }
    }, 60 * 1000);

    // --- Escaneo de Partidas en Vivo cada 1 min ---
    setInterval(async () => {
      try {
        const accounts = await db.collection('accounts').find({}).toArray();
        if (accounts.length === 0) return;

        // Cargar datos de campeones para el mapeo
        const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
        const champData = await champRes.json();
        const champMap = {};
        for (const c of Object.values(champData.data)) {
          champMap[c.key] = c.name;
        }

        for (const acc of accounts) {
          const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${acc.puuid.trim()}`;
          const res = await fetch(url, {
            headers: {
              "X-Riot-Token": process.env.RIOT_API_KEY.trim(),
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              "Accept-Language": "es-ES,es;q=0.9"
            }
          });
          
          if (res.ok) {
            const game = await res.json();
            
            // FILTRO: Solo Ranked SoloQ (420) y Ranked Flex (440)
            const allowedQueues = [420, 440];
            if (!allowedQueues.includes(game.gameQueueConfigId)) {
              continue; // Ignorar partidas que no sean Ranked
            }

            if (!liveCache.has(acc.puuid)) {
              // Re-anclar al cache si el servidor se reinició durante una partida
              liveCache.add(acc.puuid); 

              if (acc.lastLiveGameId !== game.gameId) {
                const me = game.participants.find(p => p.puuid === acc.puuid);
                const champKey = Object.keys(champData.data).find(key => champData.data[key].key == me.championId);
                const champName = champKey ? champData.data[champKey].name : 'Desconocido';
                
                console.log(`[Live] Partida detectada: ${acc.gameName} con ${champName} (ID: ${game.gameId})`);
                const now = new Date();
                await db.collection('accounts').updateOne(
                  { puuid: acc.puuid }, 
                  { $set: { liveGameStartedAt: now, lastLiveGameId: game.gameId } }
                );
                const sentMsg = await notifyLiveGame(acc, { 
                  championName: champName, 
                  championId: champKey, 
                  profileIconId: me.profileIconId,
                  version: DDRAGON_VERSION 
                });

                // Borrar notificación después de 5 minutos (ventana de apuestas)
                if (sentMsg) {
                  setTimeout(() => {
                    sentMsg.delete().catch(err => console.error('[Bot] Error al borrar notificación:', err));
                  }, 5 * 60 * 1000);
                }
              }
            }
          } else if (res.status === 404) {
            // SÓLO si es 404 (Not Found) significa que la partida terminó
            if (liveCache.has(acc.puuid)) {
              liveCache.delete(acc.puuid); 
              console.log(`[Live] Partida finalizada para ${acc.gameName}`);
              await db.collection('accounts').updateOne({ puuid: acc.puuid }, { $unset: { liveGameStartedAt: "" } });
              settleBets(acc);
            }
          } else if (res.status === 429) {
            console.warn(`[Live RateLimit] Riot nos está limitando (429). Saltando escaneo para ${acc.gameName}`);
          } else {
            console.error(`[Live API Error] Código ${res.status} para ${acc.gameName}. Ignorando.`);
          }
        }
      } catch(e) {
        console.error('[Live Error] Error en el escaneo de partidas:', e.message);
      }
    }, 1 * 60 * 1000);
  } catch(e) {
    console.error('❌ Error conectando a MongoDB:', e);
    console.log('Reintentando en 5 segundos...');
    setTimeout(connectDB, 5000);
  }
}

// Lógica de cálculo de MVP y Logros
function calculateMatchHighlights(match) {
  const participants = match.info.participants;
  if (!participants || participants.length === 0) return null;

  let mvp = participants[0];
  let maxScore = -999;
  
  let topDamage = participants[0];
  let topVision = participants[0];
  let topGold = participants[0];

  participants.forEach(p => {
    // Fórmula de puntuación balanceada
    const score = (p.kills * 4) + (p.assists * 2.5) - (p.deaths * 3) + (p.totalDamageDealtToChampions / 1500) + (p.visionScore / 1.5) + (p.goldEarned / 1000);
    
    if (score > maxScore) {
      maxScore = score;
      mvp = p;
    }
    if (p.totalDamageDealtToChampions > topDamage.totalDamageDealtToChampions) topDamage = p;
    if (p.visionScore > topVision.visionScore) topVision = p;
    if (p.goldEarned > topGold.goldEarned) topGold = p;
  });

  const getName = (p) => p.riotIdGameName || p.summonerName || 'Desconocido';

  return {
    mvp: { name: getName(mvp), champion: mvp.championName },
    topDamage: { name: getName(topDamage), champion: topDamage.championName, value: topDamage.totalDamageDealtToChampions },
    topVision: { name: getName(topVision), champion: topVision.championName, value: topVision.visionScore },
    topGold: { name: getName(topGold), champion: topGold.championName, value: topGold.goldEarned }
  };
}

// Función para liquidar apuestas
async function settleBets(acc) {
  try {
    // 1. Esperar a que la API actualice el historial (120 seg para asegurar LP)
    console.log(`[Bets] Procesando resultados para ${acc.gameName}...`);
    await new Promise(r => setTimeout(r, 120000));

    // 2. Obtener el resultado de la última partida
    const matchUrl = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${acc.puuid.trim()}/ids?count=1`;
    const matchIdsRes = await fetch(matchUrl, {
      headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() }
    });
    const matchIds = await matchIdsRes.json();
    
    if (!matchIds || matchIds.length === 0) {
      // Si no hay partidas nuevas tras 100seg, quizá fue un error de Riot
      // Limpiamos el cache tras 5 minutos de inactividad para no trabar
      return;
    }

    const detailUrl = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchIds[0]}`;
    const detailRes = await fetch(detailUrl, {
      headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() }
    });
    const match = await detailRes.json();
    
    // FILTRO: Solo liquidar apuestas y retos en Ranked SoloQ (420) y Ranked Flex (440)
    const allowedQueues = [420, 440];
    if (!allowedQueues.includes(match.info.queueId)) {
      console.log(`[Bets] Partida ignorada (Queue ID: ${match.info.queueId}) para ${acc.gameName}`);
      return;
    }
    
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

    // --- Cálculo de Estadísticas Extras con Reintentos ---
    const kda = `${p.kills}/${p.deaths}/${p.assists}`;
    let lpDataObj = null;
    
    // Solo calcular LP si es Clasificatoria
    const isRanked = match.info.queueId === 420 || match.info.queueId === 440;
    
    if (isRanked) {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
      try {
        const leagueUrl = `https://la1.api.riotgames.com/lol/league/v4/entries/by-puuid/${acc.puuid}`;
        const leagueRes = await fetch(`${leagueUrl}?api_key=${API_KEY}`);
        const leagues = await leagueRes.json();
        
        // Identificar el tipo de cola objetivo según la partida
        const targetQueueType = match.info.queueId === 420 ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR';
        const soloQ = leagues.find(l => l.queueType === targetQueueType);
        
        if (soloQ) {
          // ACTUALIZACIÓN: Guardar el nuevo rango en la DB
          await db.collection('accounts').updateOne({ puuid: acc.puuid }, { $set: { soloQ: soloQ } });

          const oldLp = acc.soloQ?.leaguePoints || 0;
          const oldTier = acc.soloQ?.tier || 'UNRANKED';
          const oldRank = acc.soloQ?.rank || '';
          
          const diff = soloQ.leaguePoints - oldLp;
          
          lpDataObj = { tier: soloQ.tier, rank: soloQ.rank, lp: soloQ.leaguePoints, diff: diff };

          // Si el LP o el Rango ha cambiado
          if (soloQ.leaguePoints !== oldLp || soloQ.tier !== oldTier || soloQ.rank !== oldRank) {
            break; 
          }
        }
      } catch (e) {
        console.error('[LP Retry Error]', e);
      }

        attempts++;
        if (attempts < maxAttempts && !lpDataObj) {
          console.log(`[Bets] LP no actualizado para ${acc.gameName}. Reintento ${attempts}/${maxAttempts} en 45s...`);
          await new Promise(r => setTimeout(r, 45000));
        }
      }
    }

    // 4. Notificar en Discord con toda la info
    const highlights = calculateMatchHighlights(match);
    notifyBetResults(
      `${acc.gameName}#${acc.tagLine}`, 
      gameResult, 
      winners, 
      p.profileIcon, 
      p.championName, 
      lpDataObj, 
      kda, 
      DDRAGON_VERSION, 
      openBets.length, 
      match.info.queueId,
      highlights
    );
    
    // IMPORTANTE: Limpiar cache para permitir nueva partida
    clearCache();

    // --- NUEVO: Motor de Retos Automáticos ---
    await checkChallenges(acc, match);

  } catch (e) {
    console.error('[Bets Error]', e);
    // Limpiar de todos modos para no trabar el bot
    liveCache.delete(acc.puuid);
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

// ---- Rutas de Perfil Web ----
app.get('/api/profile/:discordId', async (req, res) => {
  const { discordId } = req.params;
  try {
    if (!db) return res.status(503).json({ error: 'DB no lista' });
    const eco = await db.collection('economy').findOne({ discordId });
    if (!eco) return res.status(404).json({ error: 'Perfil no encontrado' });
    
    // Buscar cuenta de LoL vinculada si existe
    let linkedAcc = null;
    if (eco.linkedPuuid) {
      linkedAcc = await db.collection('accounts').findOne({ puuid: eco.linkedPuuid });
    }
    
    // Fallback: si no hay linkedPuuid en eco, buscar en accounts por discordId
    if (!linkedAcc) {
      linkedAcc = await db.collection('accounts').findOne({ discordId });
    }
    
    res.json({ ...eco, linkedAcc });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/perfil/:discordId', (req, res) => {
  res.sendFile(path.join(__dirname, 'perfil.html'));
});

app.get('/api/items', (req, res) => {
  res.json(GACHA_ITEMS || []);
});

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
    // Usamos agregación para traer los datos de economía vinculados por discordId
    const accounts = await getCollection().aggregate([
      { $sort: { addedAt: -1 } },
      {
        $lookup: {
          from: 'economy',
          localField: 'discordId',
          foreignField: 'discordId',
          as: 'eco'
        }
      },
      {
        $addFields: {
          economy: { $arrayElemAt: ['$eco', 0] }
        }
      },
      { $project: { eco: 0 } } // Limpiamos el array temporal
    ]).toArray();
    
    res.json(accounts);
  } catch(e) {
    console.error('Error leyendo cuentas con economía:', e);
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
    const accounts = await db.collection('accounts').aggregate([
      {
        $lookup: {
          from: 'economy',
          localField: 'discordId',
          foreignField: 'discordId',
          as: 'eco'
        }
      },
      {
        $addFields: {
          economy: { $arrayElemAt: ['$eco', 0] }
        }
      },
      { $project: { eco: 0 } }
    ]).toArray();
    
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
        profileIconId: a.profileIconId,
        economy: a.economy
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
    const rankImg = `/pic/ranks/${tier.toLowerCase()}.png`;
    
    const profileIconUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${acc.profileIconId}.png`;
    const faviconUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/Naafiri.png`;
    
    const rankColors = {
      IRON: '#51484a', BRONZE: '#8c5230', SILVER: '#80989d', GOLD: '#cd8837',
      PLATINUM: '#4e9996', EMERALD: '#27a170', DIAMOND: '#576bce', MASTER: '#9d5ade',
      GRANDMASTER: '#d93f3f', CHALLENGER: '#f4c874', UNRANKED: '#657099'
    };
    const themeColor = rankColors[tier] || '#ffffff';

    const wins = acc.soloQ?.wins || 0;
    const losses = acc.soloQ?.losses || 0;
    const totalGames = wins + losses;
    const wr = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    const streakText = acc.streak > 0 ? `🔥 ${acc.streak} Wins` : acc.streak < 0 ? `❄️ ${Math.abs(acc.streak)} Loss` : '—';

    // Datos de economía si está vinculado
    let ecoData = null;
    if (acc.discordId) {
      ecoData = await db.collection('economy').findOne({ discordId: acc.discordId });
    }

    const noDivisionTiersList = ['MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];
    const rankDisplay = noDivisionTiersList.includes(tier) ? tier : `${tier} ${acc.soloQ?.rank || ''}`;

    // -- LÓGICA DE PANELES LATERALES --
    let kdaStr = '0.00';
    let kpAvg = 0;
    let goldMin = 0;
    let dmgAvg = 0;
    let recentWR = 0;
    let visionAvg = 0;
    let csAvg = 0;
    let objDmgAvg = 0;
    
    if (acc.matches && acc.matches.length > 0) {
      const mCount = acc.matches.length;
      let k = 0, d = 0, a = 0, kp = 0, gold = 0, dur = 0, dmg = 0, w = 0, vis = 0, cs = 0, objDmg = 0;
      acc.matches.forEach(m => {
        k += m.kills || 0;
        d += m.deaths || 0;
        a += m.assists || 0;
        kp += m.kp || 0;
        gold += m.gold || 0;
        dur += m.gameDuration || 0;
        dmg += m.damage || 0;
        vis += m.vision || 0;
        cs += m.cs || 0;
        objDmg += m.dmgObj || 0;
        if (m.win) w++;
      });
      const dSafe = d === 0 ? 1 : d;
      kdaStr = ((k + a) / dSafe).toFixed(2);
      kpAvg = Math.round(kp / mCount);
      goldMin = dur > 0 ? Math.round(gold / (dur / 60)) : 0;
      dmgAvg = Math.round(dmg / mCount);
      recentWR = Math.round((w / mCount) * 100);
      visionAvg = Math.round(vis / mCount);
      csAvg = dur > 0 ? (cs / (dur / 60)).toFixed(1) : 0;
      objDmgAvg = Math.round(objDmg / mCount);
    }

    const getChampImg = (c) => {
      let img = '';
      if (typeof c.image === 'string') img = c.image;
      else if (c.image && c.image.full) img = c.image.full;
      else if (c.name) img = c.name.replace(/ /g,'').replace(/'/g,'').replace(/\./g,'');
      else return 'Unknown.png';
      
      if (!img.endsWith('.png')) img += '.png';
      
      const specialCases = {
        'Wukong.png': 'MonkeyKing.png',
        'RenataGlasc.png': 'Renata.png',
        'BelVeth.png': 'Belveth.png',
        'ChoGath.png': 'Chogath.png',
        'KhaZix.png': 'Khazix.png',
        'KaiSa.png': 'Kaisa.png',
        'LeBlanc.png': 'Leblanc.png',
        'VelKoz.png': 'Velkoz.png',
        'FiddleSticks.png': 'Fiddlesticks.png',
        'Nunu.png': 'Nunu.png',
        'JarvanIV.png': 'JarvanIV.png',
        'Nunu&Willump.png': 'Nunu.png'
      };
      
      return specialCases[img] || img;
    };

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${acc.gameName}#${acc.tagLine} - LAN Tracker</title>
      <link rel="icon" type="image/png" href="${faviconUrl}">
      <link rel="icon" type="image/x-icon" href="${profileIconUrl}">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Cinzel:wght@700&display=swap" rel="stylesheet">
      <style>
        :root { --rank-color: ${themeColor}; }
        body { 
          font-family: 'Inter', sans-serif; 
          background: radial-gradient(circle at top, #1a1c2c, #070810); 
          color: #f2f4ff; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          min-height: 100vh; 
          margin: 0;
          overflow-x: hidden;
        }

        /* Scrollbar Temático */
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #070810; }
        ::-webkit-scrollbar-thumb { 
          background: linear-gradient(180deg, #181a28, var(--rank-color)); 
          border: 2px solid #070810; 
          border-radius: 10px; 
        }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, var(--rank-color), #fff); }
        
        .admin-force-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          transition: 0.3s;
          z-index: 1000;
        }
        .admin-force-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border-color: rgba(255,255,255,0.3);
        }
        .layout-wrapper { display: flex; align-items: flex-start; justify-content: center; gap: 30px; width: 100%; max-width: 1200px; padding: 40px 20px; }
        .side-panel { background: rgba(13, 17, 28, 0.6); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 25px; width: 260px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); opacity: 0; animation: fadeSide 0.6s ease forwards 0.2s; }
        .panel-left { order: 1; }
        .center-card { order: 2; z-index: 10; }
        .panel-right { order: 3; }
        @keyframes fadeSide { to { opacity: 1; transform: translateY(0); } from { opacity: 0; transform: translateY(20px); } }
        .panel-title { font-size: 0.8rem; letter-spacing: 2px; text-transform: uppercase; color: var(--rank-color); font-weight: 900; margin-bottom: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; }
        .panel-subtitle { font-size: 0.65rem; letter-spacing: 1px; text-transform: uppercase; color: #657099; font-weight: 800; margin: 15px 0 10px 0; text-align: left; }
        .champ-row { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .champ-row img { width: 45px; height: 45px; border-radius: 12px; border: 1px solid var(--rank-color); object-fit: cover; }
        .c-name { display: block; font-weight: 800; font-size: 0.95rem; }
        .c-pts { display: block; font-size: 0.75rem; color: #657099; }
        .side-stat { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: rgba(255,255,255,0.02); padding: 10px 12px; border-radius: 10px; }
        .s-label { font-size: 0.75rem; color: #9aa3c7; font-weight: 700; text-transform: uppercase; }
        .s-val { font-size: 1.1rem; font-weight: 900; }
        
        @media (max-width: 1050px) { 
          .layout-wrapper { flex-direction: column; align-items: center; } 
          .center-card { order: 1; }
          .panel-left { order: 2; width: 380px; }
          .panel-right { order: 3; width: 380px; }
        }
        
        .bg-glow {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at 50% -20%, var(--rank-color)33, transparent 70%);
          z-index: -1;
        }
        .card { 
          background: rgba(13, 17, 28, 0.8); 
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1); 
          width: 380px;
          border-radius: 24px; 
          padding: 30px;
          text-align: center; 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
          position: relative;
          overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px;
          background: linear-gradient(90deg, transparent, var(--rank-color), transparent);
        }
        .profile-header { position: relative; margin-bottom: 20px; }
        .avatar {
          width: 100px; height: 100px; border-radius: 50%;
          border: 3px solid var(--rank-color);
          padding: 5px; background: #070810;
          box-shadow: 0 0 20px var(--rank-color)44;
        }
        .level-badge {
          position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
          background: var(--rank-color); color: #000; font-weight: 900;
          font-size: 0.7rem; padding: 2px 10px; border-radius: 10px;
        }
        h1 { font-family: 'Cinzel', serif; margin: 15px 0 5px 0; font-size: 1.8rem; letter-spacing: 1px; }
        .tag { color: #657099; opacity: 0.7; }
        .rank-emblem { width: 140px; filter: drop-shadow(0 0 15px var(--rank-color)66); margin: 10px 0; }
        .rank-name { font-size: 1.4rem; font-weight: 900; color: var(--rank-color); text-transform: uppercase; margin-bottom: 5px; }
        .lp { font-size: 0.9rem; color: #9aa3c7; letter-spacing: 2px; }
        
        .stats-grid { 
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 25px;
        }
        .stat-card {
          background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .stat-label { font-size: 0.65rem; color: #657099; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 1.1rem; font-weight: 800; }
        
        .wr-bar-container { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .wr-bar-fill { height: 100%; background: var(--rank-color); border-radius: 3px; }

        .discord-section {
          margin-top: 25px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1);
          display: flex; justify-content: space-around; align-items: center;
        }
        .eco-item { text-align: center; }
        .eco-val { display: block; font-weight: 900; color: #f4c874; }
        .eco-lab { font-size: 0.6rem; color: #657099; text-transform: uppercase; }

        .watermark { display: none; }
        .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); opacity: 0.35; letter-spacing: 5px; font-weight: 900; font-size: 0.72rem; text-align: center; }

        /* --- Historial de Partidas V2 --- */
        .match-v2-card {
            display: grid; grid-template-columns: 70px 110px 175px 115px 60px 50px;
            align-items: center; background: rgba(16, 20, 34, 0.7); border-radius: 8px;
            overflow: hidden; min-height: 75px; transition: all 0.2s ease; cursor: pointer;
            border: 1px solid rgba(255,255,255,0.03); position: relative; margin-bottom: 8px;
            text-align: left;
        }
        .match-v2-card:hover { background: rgba(23, 28, 48, 0.9); transform: translateX(4px); border-color: rgba(255,255,255,0.1); }
        .mv2-win { border-left: 5px solid #28ab66 !important; }
        .mv2-loss { border-left: 5px solid #e84057 !important; }
        .mv2-champ-block { display: flex; justify-content: center; align-items: center; width: 70px; }
        .mv2-main-icon { width: 50px; height: 50px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); object-fit: cover; }
        .mv2-info-block { display: flex; flex-direction: column; justify-content: center; gap: 2px; }
        .mv2-result { font-weight: 900; font-size: 0.85rem; letter-spacing: 0.5px; text-transform: uppercase; }
        .mv2-queue { font-size: 0.72rem; color: #657099; }
        .mv2-kda-block { display: flex; flex-direction: column; justify-content: center; gap: 2px; }
        .mv2-kda-text { font-weight: 900; font-size: 1.2rem; color: #f2f4ff; letter-spacing: -0.5px; line-height: 1; }
        .mv2-stats { font-size: 0.72rem; color: #657099; margin-top: 2px; }
        .mv2-items-grid { display: grid; grid-template-columns: repeat(4, 24px); grid-template-rows: repeat(2, 24px); gap: 2px; }
        .mv2-item { width: 24px; height: 24px; border-radius: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); object-fit: cover; display: block; }
        .mv2-item.empty { background: rgba(255,255,255,0.03); }
        .mv2-participants { display: flex; gap: 3px; align-items: center; justify-content: center; padding: 0 4px; }
        .mv2-p-col { display: flex; flex-direction: column; gap: 2px; }
        .mv2-p-icon { width: 22px; height: 22px; }
        .mv2-p-icon img { width: 22px; height: 22px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.08); object-fit: cover; display: block; }
        .mv2-p-icon.me img { border-color: #f4c874; box-shadow: 0 0 5px rgba(244,200,116,0.7); }
        .mv2-meta { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #657099; font-size: 0.72rem; }
        .mv2-meta-label { opacity: 0.6; margin-bottom: 2px; }
        .mv2-duration { font-weight: 700; color: #8c96bc; }
        .mv2-expand-icon { display: flex; justify-content: center; align-items: center; color: #657099; font-size: 1.1rem; opacity: 0.5; }
        .text-win { color: #28ab66; }
        .text-loss { color: #e84057; }

        .history-container { width: 100%; max-width: 1000px; margin: 30px auto 50px auto; padding: 0 20px; animation: fadeSide 0.6s ease forwards 0.4s; opacity: 0; }
        .history-title { font-family: 'Cinzel', serif; font-size: 1.4rem; color: #f2f4ff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 15px; text-align: center; }
        
        /* Estilos del Modal */
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
          display: none; justify-content: center; align-items: center; z-index: 2000;
        }
        .modal-content {
          background: #0d111c; width: 95%; max-width: 1000px; max-height: 85vh;
          border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
          overflow-y: auto; position: relative; padding: 20px;
          box-shadow: 0 0 50px rgba(0,0,0,1);
        }
        .modal-close {
          position: absolute; top: 20px; right: 20px; font-size: 1.5rem;
          color: #657099; cursor: pointer; transition: 0.3s;
        }
        .modal-close:hover { color: #f2f4ff; }
        
        .scoreboard-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.82rem; }
        .scoreboard-table th { text-align: left; padding: 6px 10px; color: #657099; border-bottom: 1px solid rgba(255,255,255,0.05); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; }
        .scoreboard-table td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
        
        .team-header { font-weight: 900; font-size: 1rem; padding: 10px 12px; display: flex; align-items: center; gap: 10px; border-radius: 8px 8px 0 0; }
        .blue-team { color: #00b4ff; background: rgba(0, 180, 255, 0.1); border-bottom: 2px solid #00b4ff; }
        .red-team { color: #ff4b4b; background: rgba(255, 75, 75, 0.1); border-bottom: 2px solid #ff4b4b; }
        
        .player-cell { display: flex; align-items: center; gap: 8px; min-width: 140px; }
        .player-champ-icon { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); }
        .spells-runes { display: flex; flex-direction: column; gap: 1px; }
        .spell-icon, .rune-icon { width: 14px; height: 14px; border-radius: 2px; }
        .player-name-link { font-weight: 700; color: #f2f4ff; text-decoration: none; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
        
        .item-list { display: flex; gap: 2px; }
        .item-icon { width: 22px; height: 22px; border-radius: 4px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); }
        .empty-item { width: 22px; height: 22px; border-radius: 4px; background: rgba(255,255,255,0.02); }
        
        .score-kda { font-weight: 800; font-size: 0.85rem; display: block; }
        .score-sub { font-size: 0.65rem; color: #657099; display: block; }
        
        .dmg-bar-container { width: 80px; height: 14px; background: rgba(255,255,255,0.05); border-radius: 2px; position: relative; overflow: hidden; }
        .dmg-bar-fill { height: 100%; background: #ff4b4b; opacity: 0.7; }
        .dmg-bar-text { position: absolute; top: 0; left: 0; width: 100%; height: 100%; font-size: 0.65rem; font-weight: 800; text-align: center; line-height: 14px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

        .team-stats-summary { display: flex; gap: 20px; margin-top: 10px; font-size: 0.75rem; color: #9aa3c7; font-weight: 700; }
        .t-stat { display: flex; align-items: center; gap: 5px; }
        
        .loading-modal { text-align: center; padding: 50px; }
        .spinner { border: 4px solid rgba(255,255,255,0.1); border-left-color: #f4c874; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Pestañas del Modal */
        .modal-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; }
        .modal-tab { padding: 8px 16px; color: #657099; cursor: pointer; font-weight: 700; font-size: 0.85rem; border-radius: 6px; transition: 0.3s; }
        .modal-tab:hover { background: rgba(255,255,255,0.05); color: #f2f4ff; }
        .modal-tab.active { background: #f4c874; color: #000; }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        /* Contenedor principal de layout vertical */
        .page-container { display: flex; flex-direction: column; align-items: center; width: 100%; }
      </style>
    </head>
    <body>
      <div class="bg-glow"></div>
      
      ${req.query.admin === '1' ? `
      <button class="admin-force-btn" onclick="forceUpdate()">⚙️ FORZAR ACTUALIZACIÓN</button>
      <script>
        async function forceUpdate() {
          const key = prompt('Introduce la clave de Administrador para forzar la actualización:');
          if (key) {
            const btn = document.querySelector('.admin-force-btn');
            btn.textContent = '⏳ ACTUALIZANDO...';
            try {
              const res = await fetch('/player/${acc.puuid}/force-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
              });
              const data = await res.json();
              if (res.ok) {
                location.reload();
              } else {
                alert('Error: ' + data.error);
                btn.textContent = '⚙️ FORZAR ACTUALIZACIÓN';
              }
            } catch(e) {
              alert('Error de red');
              btn.textContent = '⚙️ FORZAR ACTUALIZACIÓN';
            }
          }
        }
      </script>
      ` : ''}

      <div class="page-container">
        <div class="layout-wrapper">
          <!-- PANEL IZQUIERDO -->
        <div class="side-panel panel-left">
          <div class="panel-title">Campeones</div>
          <div class="panel-subtitle">Top Maestría</div>
          ${acc.topChampions && acc.topChampions.length > 0 ? acc.topChampions.map(c => `
            <div class="champ-row">
              <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImg(c)}" onerror="this.src='https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png'">
              <div>
                <span class="c-name">${c.name}</span>
                <span class="c-pts">${(c.points || 0).toLocaleString()} pts <span style="color:#f4c874;font-size:0.65rem;">(Lvl ${c.level || 0})</span></span>
              </div>
            </div>
          `).join('') : '<div style="text-align:center; color:#657099; font-size:0.8rem;">Sin datos de maestría</div>'}

          <div class="panel-subtitle" style="margin-top: 25px;">Más Jugados (Recientes)</div>
          ${acc.recentChampions && acc.recentChampions.length > 0 ? acc.recentChampions.map(c => `
            <div class="champ-row">
              <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImg(c)}" onerror="this.src='https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png'">
              <div>
                <span class="c-name">${c.name}</span>
                <span class="c-pts" style="color:#00ff88;">En últimas 20 partidas</span>
              </div>
            </div>
          `).join('') : '<div style="text-align:center; color:#657099; font-size:0.8rem; margin-bottom:10px;">Juega partidas para ver esto</div>'}
        </div>

        <!-- TARJETA CENTRAL -->
        <div class="card center-card">
        <div class="profile-header">
          <img src="${profileIconUrl}" class="avatar">
          <span class="level-badge">LVL ${acc.summonerLevel}</span>
        </div>
        
        <h1>${acc.gameName}<span class="tag">#${acc.tagLine}</span></h1>
        <div style="font-size:0.85rem; color:#f4c874; margin-top: -5px; font-weight:800; letter-spacing:1px; margin-bottom: 10px;">${acc.mainPosition ? acc.mainPosition : '—'}</div>
        
        <img src="${rankImg}" class="rank-emblem">
        <div class="rank-name">${rankDisplay}</div>
        <div class="lp">${acc.soloQ?.leaguePoints || 0} LP <span style="font-size:0.7rem; color:#9aa3c7;">(SoloQ)</span></div>
        
        ${acc.flex ? `
        <div style="margin-top: 10px; font-size:0.75rem; color:#657099; font-weight:800; background:rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; display:inline-block; border: 1px solid rgba(255,255,255,0.05);">
          FLEX: <span style="color:#f2f4ff;">${['MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'].includes(acc.flex.tier) ? acc.flex.tier : `${acc.flex.tier} ${acc.flex.rank}`} - ${acc.flex.leaguePoints} LP</span>
        </div>
        ` : ''}

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Winrate</span>
            <span class="stat-value" style="color: ${wr > 50 ? '#00ff88' : '#ff4444'}">${wr}%</span>
            <div class="wr-bar-container"><div class="wr-bar-fill" style="width: ${wr}%"></div></div>
          </div>
          <div class="stat-card">
            <span class="stat-label">Racha Actual</span>
            <span class="stat-value">${streakText}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Victorias</span>
            <span class="stat-value" style="color: #00ff88">${wins}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Derrotas</span>
            <span class="stat-value" style="color: #ff4444">${losses}</span>
          </div>
        </div>

        ${ecoData ? `
        <div class="discord-section">
          <div class="eco-item">
            <span class="eco-val">💰 ${ecoData.coins}</span>
            <span class="eco-lab">Naafiri Coins</span>
          </div>
          <div class="eco-item">
            <span class="eco-val">🎒 ${ecoData.inventory?.length || 0}</span>
            <span class="eco-lab">Objetos</span>
          </div>
        </div>
        ` : ''}

        <div class="footer">LAS PERRAS DE NAAFIRI</div>
        </div>

        <!-- PANEL DERECHO -->
        <div class="side-panel panel-right">
          <div class="panel-title">Desempeño (${acc.matches?.length || 0} SoloQ)</div>
          <div class="side-stat">
            <span class="s-label">WR Reciente</span>
            <span class="s-val" style="color: ${recentWR >= 50 ? '#00ff88' : '#ff4444'}">${recentWR}%</span>
          </div>
          <div class="side-stat">
            <span class="s-label">KDA Promedio</span>
            <span class="s-val">${kdaStr}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">CS / Min</span>
            <span class="s-val">${csAvg}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">Visión / Partida</span>
            <span class="s-val">${visionAvg}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">Daño a Campeones</span>
            <span class="s-val">${dmgAvg.toLocaleString()}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">Daño Objetivos</span>
            <span class="s-val">${objDmgAvg.toLocaleString()}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">Oro / Minuto</span>
            <span class="s-val">${goldMin}</span>
          </div>
          <div class="side-stat">
            <span class="s-label">Participación Kills</span>
            <span class="s-val">${kpAvg}%</span>
          </div>
        </div>
      </div> <!-- fin layout-wrapper -->

      <!-- HISTORIAL DE PARTIDAS -->
      ${acc.matches && acc.matches.length > 0 ? `
      <div class="history-container">
        <h2 class="history-title">Últimas Partidas</h2>
        ${acc.matches.map((m, i) => {
          const isWin = m.win;
          const cls = isWin ? 'mv2-win' : 'mv2-loss';
          const kda = m.kills + ' / ' + m.deaths + ' / ' + m.assists;
          const dur = Math.floor(m.gameDuration / 60) + 'm ' + (m.gameDuration % 60) + 's';
          const champImg = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImg({image: m.champion})}`;
          
          // Items - Asegurar 8 slots
          let itmArr = m.items || [];
          if (itmArr.length === 0) itmArr = [0,0,0,0,0,0,0,0];
          const itemsHTML = itmArr.slice(0, 8).map(id => {
            if (!id || id === 0) return '<div class="mv2-item empty"></div>';
            return `<img class="mv2-item" src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png">`;
          }).join('');
          const extraItemsHTML = itmArr.length < 8 ? Array(8 - itmArr.length).fill('<div class="mv2-item empty"></div>').join('') : '';

          // Participants
          const parts = m.participants || [];
          let participantsHTML = '';
          if (parts.length >= 10) {
            const team1 = parts.slice(0, 5);
            const team2 = parts.slice(5, 10);
            const renderPart = (p) => {
              const pImg = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImg({image: p.champion})}`;
              return `<div class="mv2-p-icon"><img src="${pImg}" title="${p.champion}"></div>`;
            };
            participantsHTML = `<div class="mv2-participants"><div class="mv2-p-col">${team1.map(renderPart).join('')}</div><div class="mv2-p-col">${team2.map(renderPart).join('')}</div></div>`;
          }

          return `
          <div class="match-v2-card ${cls}" onclick="openMatchModal('${m.matchId}')">
            <div class="mv2-champ-block">
              <img class="mv2-main-icon" src="${champImg}">
            </div>
            <div class="mv2-info-block">
              <div class="mv2-result ${isWin ? 'text-win' : 'text-loss'}">${isWin ? 'VICTORIA' : 'DERROTA'}</div>
              <div class="mv2-queue">SoloQ</div>
            </div>
            <div class="mv2-kda-block">
              <div class="mv2-kda-text">${kda}</div>
              <div class="mv2-stats">${m.cs || 0} CS - ${m.kp || 0}% P. asesinat.</div>
            </div>
            <div class="mv2-items-grid">${itemsHTML}${extraItemsHTML}</div>
            ${participantsHTML}
            <div class="mv2-meta">
              <div class="mv2-meta-label">Partida</div>
              <div class="mv2-duration">${dur}</div>
            </div>
            <div class="mv2-expand-icon">📈</div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}
      </div> <!-- fin page-container -->

      <!-- MODAL DE DETALLES -->
      <div id="matchModal" class="modal-overlay" onclick="closeMatchModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
          <span class="modal-close" onclick="closeMatchModal(event)">×</span>
          <div id="modalBody">
            <div class="loading-modal">
              <div class="spinner"></div>
              <p>Consultando a Riot Games...</p>
            </div>
          </div>
        </div>
      </div>

      <script src="/chart.min.js"></script>
      <script src="/render.js"></script>
    </body>
    </html>
    `;
    res.send(html);
  } catch(e) {
    console.error('Error sirviendo perfil:', e);
    res.status(500).send('Error interno');
  }
});

// ---- Lógica de Actualización en el Backend (Opción C) ----
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function backendGetMatchIds(puuid) {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20&api_key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function backendGetMatchDetail(matchId) {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

let backendChampionDataCache = null;
async function backendGetChampionData() {
  if (backendChampionDataCache) return backendChampionDataCache;
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
    const data = await res.json();
    const map = {};
    for (const champ of Object.values(data.data)) {
      map[String(champ.key)] = { name: champ.name, image: champ.image.full };
    }
    backendChampionDataCache = map;
    return map;
  } catch(e) {
    return {};
  }
}

async function backendGetTopMastery(puuid) {
  try {
    const url = `https://la1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const masteries = await res.json();
    if (!Array.isArray(masteries)) return [];
    
    const top3 = masteries.slice(0, 3);
    const champData = await backendGetChampionData();
    return top3.map(m => {
      const info = champData[String(m.championId)] || {};
      return {
        name: info.name || 'Unknown',
        image: info.image || null,
        points: m.championPoints || 0,
        level: m.championLevel || 0
      };
    });
  } catch(e) {
    console.error('Error backend mastery:', e);
    return [];
  }
}

async function backendFetchMatchHistory(puuid) {
  try {
    const matchIds = await backendGetMatchIds(puuid);
    if (!matchIds || matchIds.length === 0) return { matches: [], streak: 0, mainPosition: '—', recentChampions: [] };
    
    const details = [];
    for (let i = 0; i < matchIds.length; i++) {
      await sleep(150); // Ratelimit protection
      try {
        const match = await backendGetMatchDetail(matchIds[i]);
        if (!match || !match.info) continue;
        const p = match.info.participants.find(x => x.puuid === puuid);
        if (!p) continue;
        details.push({
          matchId: match.metadata?.matchId || matchIds[i],
          champion: p.championName,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          gameDuration: match.info.gameDuration,
          cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
          damage: p.totalDamageDealtToChampions || 0,
          vision: p.visionScore || 0,
          gold: p.goldEarned || 0,
          kp: p.challenges?.killParticipation ? Math.round(p.challenges.killParticipation * 100) : 0,
          dmgObj: p.totalDamageDealtToObjectives || 0,
          position: p.teamPosition || ''
        });
      } catch(e) {
        console.error('Error fetching match detail backend:', e);
      }
    }

    let streak = 0;
    if (details.length > 0) {
      const first = details[0].win;
      for (const m of details) {
        if (m.win === first) streak++;
        else break;
      }
      streak = first ? streak : -streak;
    }

    const POSITION_LABELS = { TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support', '': '—' };
    const posCount = {};
    for (const m of details) {
      if (m.position) posCount[m.position] = (posCount[m.position] || 0) + 1;
    }
    const mainPos = Object.entries(posCount).sort((a,b) => b[1]-a[1])[0];
    const mainPosition = mainPos ? (POSITION_LABELS[mainPos[0]] || mainPos[0]) : '—';
    
    const champCount = {};
    for (const m of details) {
      if (!champCount[m.champion]) champCount[m.champion] = 0;
      champCount[m.champion]++;
    }
    const recentChampions = Object.entries(champCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => ({ name, image: name }));

    return { matches: details, streak, mainPosition, recentChampions };
  } catch(e) {
    console.error('Backend match history error:', e);
    throw e;
  }
}

app.post('/player/:puuid/force-update', async (req, res) => {
  const { key } = req.body;
  const { puuid } = req.params;
  
  if (key !== process.env.ADMIN_WEB_KEY) {
    return res.status(401).json({ error: 'Clave de administrador incorrecta' });
  }

  try {
    const acc = await db.collection('accounts').findOne({ puuid });
    if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const [history, topChampions] = await Promise.all([
      backendFetchMatchHistory(puuid),
      backendGetTopMastery(puuid)
    ]);

    const updateFields = {};
    if (history.matches && history.matches.length > 0) {
      updateFields.matches = history.matches;
      updateFields.streak = history.streak;
      updateFields.mainPosition = history.mainPosition;
      updateFields.recentChampions = history.recentChampions;
    }
    if (topChampions && topChampions.length > 0) {
      updateFields.topChampions = topChampions;
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('accounts').updateOne({ puuid }, { $set: updateFields });
    }
    
    res.json({ ok: true });
  } catch(e) {
    console.error('Error forzando actualización:', e);
    res.status(500).json({ error: 'Error del servidor al buscar en Riot' });
  }
});

// Endpoint para obtener detalles de una partida específica (Scoreboard)
app.get('/api/match/:matchId', async (req, res) => {
  const { matchId } = req.params;
  try {
    const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(404).json({ error: 'Partida no encontrada en Riot' });
    
    const data = await response.json();
    if (!data || !data.info) return res.status(404).json({ error: 'Datos de partida inválidos' });

    // Estructurar la respuesta para el frontend
    const participants = data.info.participants.map(p => ({
      puuid: p.puuid,
      gameName: p.riotIdGameName || p.summonerName,
      tagLine: p.riotIdTagline || '',
      championId: p.championId,
      championName: p.championName,
      teamId: p.teamId,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      totalDamageDealtToChampions: p.totalDamageDealtToChampions,
      totalDamageDealtToObjectives: p.totalDamageDealtToObjectives,
      goldEarned: p.goldEarned,
      visionScore: p.visionScore,
      totalMinionsKilled: p.totalMinionsKilled + (p.neutralMinionsKilled || 0),
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      perks: p.perks, // Para las runas
      champLevel: p.champLevel,
      individualPosition: p.individualPosition,
      challenges: p.challenges
    }));

    const teams = {
      100: data.info.teams.find(t => t.teamId === 100),
      200: data.info.teams.find(t => t.teamId === 200)
    };

    // Obtener Timeline para la gráfica de ventaja de oro
    let timeline = null;
    try {
      const tUrl = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${API_KEY}`;
      const tRes = await fetch(tUrl);
      if (tRes.ok) {
        const tData = await tRes.json();
        // Solo enviamos los datos necesarios para reducir el tamaño
        timeline = tData.info.frames.map(f => {
          let blueGold = 0;
          let redGold = 0;
          Object.values(f.participantFrames).forEach(pf => {
            if (pf.participantId <= 5) blueGold += pf.totalGold;
            else redGold += pf.totalGold;
          });
          return { timestamp: f.timestamp, goldDiff: blueGold - redGold };
        });
      }
    } catch (e) {
      console.error('Error obteniendo timeline:', e);
    }

    res.json({
      gameDuration: data.info.gameDuration,
      gameMode: data.info.gameMode,
      gameCreation: data.info.gameCreation,
      participants,
      teams,
      timeline
    });
  } catch (e) {
    console.error('Error al obtener partida:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// -----------------------------------------------------------

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