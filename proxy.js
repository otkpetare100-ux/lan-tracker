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
    await db.collection('rank_history').createIndex({ puuid: 1 });
    await db.collection('rank_history').createIndex({ timestamp: -1 });
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

// Manejo de errores global
app.post('/rank-history', async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.puuid) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    await db.collection('rank_history').insertOne({
      ...entry,
      timestamp: new Date()
    });
    res.json({ ok: true });
  } catch(e) {
    console.error('Error guardando historial:', e);
    res.status(500).json({ error: 'Error guardando historial' });
  }
});

app.get('/rank-history/:puuid', async (req, res) => {
  try {
    const history = await db.collection('rank_history')
      .find({ puuid: req.params.puuid })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    res.json(history);
  } catch(e) {
    console.error('Error leyendo historial:', e);
    res.status(500).json({ error: 'Error leyendo historial' });
  }
});
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n✅ LAN Tracker corriendo en puerto ${PORT}\n`);
});