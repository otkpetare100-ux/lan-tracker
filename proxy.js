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

// Conexion a MongoDB
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('lan-tracker');
  console.log('✅ MongoDB conectado');
}
connectDB();

function getCollection() {
  return db.collection('accounts');
}

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
app.use(express.json());

// Sirve los archivos de la raíz (index.html, styles.css, app.js, etc.)
app.use(express.static(path.join(__dirname)));

// Sirve específicamente para la carpeta de rangos y pic para que Railway la reconozca
app.use('/ranks', express.static(path.join(__dirname, 'ranks')));
app.use('/pic', express.static(path.join(__dirname, 'pic')));
// -------------------------------------------

// ---- Endpoints de cuentas ----

app.get('/accounts', async (req, res) => {
  try {
    const accounts = await getCollection().find({}).toArray();
    res.json(accounts);
  } catch(e) {
    res.status(500).json({ error: 'Error leyendo cuentas' });
  }
});

app.post('/accounts', async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.puuid) return res.status(400).json({ error: 'Datos invalidos' });
  try {
    const exists = await getCollection().findOne({ puuid: entry.puuid });
    if (exists) return res.status(409).json({ error: 'Ya existe' });
    await getCollection().insertOne(entry);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error guardando cuenta' });
  }
});

app.delete('/accounts/:puuid', async (req, res) => {
  try {
    await getCollection().deleteOne({ puuid: req.params.puuid });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error eliminando cuenta' });
  }
});

app.put('/accounts/:puuid', async (req, res) => {
  try {
    await getCollection().replaceOne({ puuid: req.params.puuid }, req.body);
    res.json({ ok: true });
  } catch(e) {
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

app.listen(PORT, () => {
  console.log(`\n✅ LAN Tracker corriendo en puerto ${PORT}\n`);
});