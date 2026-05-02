const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// Diccionario de limpieza profunda
const cleanMap = {
    'Ã¢Â Å’': '❌',
    'Ã¢Å¡Â Ã¯Â¸Â ': '⚠️',
    'Ã°Å¸Â â€ ': '🏆',
    'Ã¢Â­Â ': '⭐',
    'Ã¢Â â€žÃ¯Â¸Â ': '❄️',
    'Ã°Å¸Â“Â¢': '📢',
    'Ã¢Å¡â€ Ã¯Â¸Â ': '⚔️',
    'Ã¢Ëœâ‚¬Ã¯Â¸Â ': '☀️',
    'â Œ': '❌'
};

for (const [corrupt, clean] of Object.entries(cleanMap)) {
    const regex = new RegExp(corrupt, 'g');
    content = content.replace(regex, clean);
}

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js saneado por completo.');
