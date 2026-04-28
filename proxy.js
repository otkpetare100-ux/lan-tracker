const express    = require('express');
const fetch      = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path       = require('path');
const { MongoClient } = require('mongodb');

try { require('dotenv').config(); } catch(e) {}

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
    const wrStr = wr !== null ? `${wr}%` : 'N/A';
    
    const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const rankIcon = tier !== 'UNRANKED' ? `/ranks/Season_2023_-_${titleCase(tier)}.png` : `/ranks/Season_2023_-_Unranked.png`;
    const profileIcon = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId || 1}.png`;
    const frameIcon = tier !== 'UNRANKED' ? `/pic/frame/${tier.toLowerCase()}-frame.png` : '';

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${acc.gameName}#${acc.tagLine} - LAN Tracker</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #070810;
          --card: rgba(23, 28, 48, 0.7);
          --pink: #d77aa8;
          --purple: #9d6cff;
          --text: #f2f4ff;
          --muted: #7a84aa;
        }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Inter', sans-serif; 
          background: radial-gradient(circle at top right, #1a0f2e, var(--bg) 60%);
          color: var(--text); 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          overflow: hidden;
        }
        .card { 
          background: var(--card); 
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08); 
          padding: 40px; 
          border-radius: 24px; 
          text-align: center; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); 
          width: 90%;
          max-width: 420px;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .avatar-wrap {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 20px;
        }
        .avatar {
          width: 100%;
          height: 100%;
          border-radius: 24px;
          object-fit: cover;
          box-shadow: 0 10px 20px rgba(0,0,0,0.5);
        }
        .frame {
          position: absolute;
          top: -15%;
          left: -15%;
          width: 130%;
          height: 130%;
          pointer-events: none;
        }
        .level-badge {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #0f111a;
          border: 1px solid var(--purple);
          color: var(--text);
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        h1 { margin: 0; color: var(--pink); font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; }
        .tag { color: var(--muted); font-size: 1.2rem; font-weight: 400; margin-left: 4px; }
        .divider { height: 1px; background: rgba(255,255,255,0.05); margin: 24px 0; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .stat-box { 
          background: rgba(0,0,0,0.2); 
          padding: 16px; 
          border-radius: 16px; 
          border: 1px solid rgba(255,255,255,0.03);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .stat-icon { width: 48px; height: 48px; object-fit: contain; margin-bottom: 8px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
        .stat-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 4px; }
        .stat-value { font-size: 1.1rem; font-weight: 800; color: var(--text); text-align: center; line-height: 1.2; }
        .stat-value.wr { font-size: 1.5rem; color: ${wr >= 50 ? '#73d38a' : '#e06474'}; }
        .watermark { position: fixed; bottom: 24px; color: rgba(255,255,255,0.2); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="avatar-wrap">
          <img src="${profileIcon}" alt="Avatar" class="avatar" onerror="this.src='/pic/icon.jpg'">
          ${frameIcon ? \`<img src="\${frameIcon}" class="frame" onerror="this.remove()">\` : ''}
          <div class="level-badge">${acc.summonerLevel}</div>
        </div>
        
        <h1>${escape(acc.gameName)}<span class="tag">#${escape(acc.tagLine)}</span></h1>
        
        <div class="divider"></div>
        
        <div class="stats-grid">
          <div class="stat-box">
            <img src="${rankIcon}" alt="Rank" class="stat-icon" onerror="this.src='/ranks/Season_2023_-_Unranked.png'">
            <span class="stat-label">Clasificatoria</span>
            <span class="stat-value">${rankStr}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Winrate</span>
            <span class="stat-value wr">${wrStr}</span>
            <span class="stat-label" style="margin-top: 8px; margin-bottom: 0;">${acc.soloQ ? acc.soloQ.wins + 'V ' + acc.soloQ.losses + 'D' : '—'}</span>
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