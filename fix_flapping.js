const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/proxy.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Mover liveCache al ámbito global (arriba del archivo)
content = content.replace(/const liveCache = new Set\(\);/g, '');
content = 'const liveCache = new Set();\n' + content;

// 2. Modificar el scanner para no borrar del cache ahí
content = content.replace(/liveCache\.delete\(acc\.puuid\);\s*settleBets\(acc\);/g, 'settleBets(acc);');

// 3. Modificar settleBets para borrar del cache SOLO si encuentra partida
const oldSettleStart = 'async function settleBets(acc) {';
const newSettleStart = 'async function settleBets(acc) {\n  const clearCache = () => liveCache.delete(acc.puuid);';
content = content.replace(oldSettleStart, newSettleStart);

// 4. Inyectar el borrado de cache cuando se encuentra el matchId
content = content.replace(/const matchId = ids\[0\];/, 'const matchId = ids[0];\n    if (acc.lastMatchId === matchId) return;');
content = content.replace(/await db\.collection\(\'accounts\'\)\.updateOne\(.*lastMatchId: matchId.*\}\);/, (match) => match + '\n    clearCache();');

fs.writeFileSync(path, content, 'utf8');
console.log('✅ proxy.js actualizado: liveCache global y protección contra parpadeos de Riot.');
