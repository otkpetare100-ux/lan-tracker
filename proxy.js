const express    = require('express');
const fetch      = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path       = require('path');
const { MongoClient } = require('mongodb');

try { require('dotenv').config(); } catch(e) {}
const { initBot, notifyRankChange, sendDailySummary } = require('./bot.js');

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

    // Inicializar Bot de Discord
    initBot(db);

    // Resumen Diario cada 24h
    setInterval(() => sendDailySummary(db), 24 * 60 * 60 * 1000);

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
              const game = await res.json();
              const p = game.participants.find(x => x.puuid === acc.puuid);
              notifyLiveGame(acc, { championName: '?' }); // Champion name mapping would need more logic or DDragon
              liveCache.add(acc.puuid);
            }
          } else {
            liveCache.delete(acc.puuid);
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

    res.json({ ok: true });
  } catch(e) {
    console.error('Error guardando historial de rango:', e);
    res.status(500).json({ error: 'Error guardando historial' });
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

// ---- Perfil Público (Compartir) ----
app.get('/player/:slug', async (req, res) => {
  try {
    const [gameName, tagLine] = req.params.slug.split('-');
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

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n✅ LAN Tracker corriendo en puerto ${PORT}\n`);
});