const express = require('express');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');

// Carga .env solo en local (en Railway las variables vienen del panel)
try { require('dotenv').config(); } catch(e) {}

const app  = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.RIOT_API_KEY;

if (!API_KEY) {
  console.error('❌ Falta la variable RIOT_API_KEY. Agrégala en .env o en Railway.');
  process.exit(1);
}

app.use(express.static(path.join(__dirname)));

app.get('/riot', async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Falta el parametro ?url=' });
  }

  try { targetUrl = decodeURIComponent(targetUrl); } catch(e) {}

  const allowed = [
    'americas.api.riotgames.com',
    'la1.api.riotgames.com',
    'la2.api.riotgames.com',
  ];
  const isAllowed = allowed.some(domain => targetUrl.includes(domain));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const riotRes = await fetch(`${targetUrl}${separator}api_key=${API_KEY}`);
    const data    = await riotRes.json();
    res.status(riotRes.status).json(data);
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ error: 'Error al contactar la API de Riot' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ LAN Tracker corriendo en puerto ${PORT}\n`);
});
