const express = require('express');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');
const fs      = require('fs');

try { require('dotenv').config(); } catch(e) {}

const app     = express();
const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.RIOT_API_KEY;

if (!API_KEY) {
  console.error('❌ Falta la variable RIOT_API_KEY.');
  process.exit(1);
}

// Archivo donde se guardan las cuentas compartidas
const DB_FILE = path.join(__dirname, 'accounts.json');

function readAccounts() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { return []; }
}

function writeAccounts(accounts) {
  fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ---- Endpoints de cuentas compartidas ----

// GET /accounts — devuelve todas las cuentas guardadas
app.get('/accounts', (req, res) => {
  res.json(readAccounts());
});

// POST /accounts — agrega una cuenta
app.post('/accounts', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.puuid) return res.status(400).json({ error: 'Datos invalidos' });
  const accounts = readAccounts();
  if (accounts.some(a => a.puuid === entry.puuid)) {
    return res.status(409).json({ error: 'Ya existe' });
  }
  accounts.push(entry);
  writeAccounts(accounts);
  res.json({ ok: true });
});

// DELETE /accounts/:puuid — elimina una cuenta
app.delete('/accounts/:puuid', (req, res) => {
  const { puuid } = req.params;
  const accounts = readAccounts().filter(a => a.puuid !== puuid);
  writeAccounts(accounts);
  res.json({ ok: true });
});

// PUT /accounts/:puuid — actualiza una cuenta existente
app.put('/accounts/:puuid', (req, res) => {
  const { puuid } = req.params;
  const updated  = req.body;
  let accounts   = readAccounts();
  const idx      = accounts.findIndex(a => a.puuid === puuid);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
  accounts[idx] = updated;
  writeAccounts(accounts);
  res.json({ ok: true });
});

// ---- Proxy de Riot API ----
app.get('/riot', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Falta ?url=' });

  try { targetUrl = decodeURIComponent(targetUrl); } catch(e) {}

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
