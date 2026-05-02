const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// Reparar endpoint de apuestas
content = content.replace(/const liveUrl = `https:\/\/la1\.api\.riotgames\.com\/lol\/spectator\/v5\/active-games\/by-puuid\/\${targetAcc\.puuid}\?api_key=\${process\.env\.RIOT_API_KEY}`;/g, 
    'const liveUrl = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${targetAcc.puuid.trim()}`;');

content = content.replace(/const liveRes = await fetch\(liveUrl\);/g, 
    'const liveRes = await fetch(liveUrl, { headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() } });');

// Limpiar cruces rojas corruptas (Ã¢Â Å’)
content = content.replace(/Ã¢Â Å’/g, '❌');

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Validador de apuestas REPARADO.');
