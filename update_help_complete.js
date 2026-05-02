const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

const updatedHelp = `        .addFields(
          { name: '👤 Perfil y Rango', value: '\`!perfil [Nombre#TAG]\` - Mira tu rango y estadísticas.\\n\`!stats [Nombre#TAG]\` - Estadísticas detalladas.\\n\`!vincular Nombre#TAG\` - Vincula tu cuenta de Discord.\\n\`!ladder\` - Top 10 mejores jugadores.' },
          { name: '💰 Economía', value: '\`!monedas\` - Mira tu saldo actual.\\n\`!diario\` - Reclama tus 100 coins diarias.\\n\`!top_ricos\` - Top 10 usuarios con más monedas.' },
          { name: '🎮 Diversión y Apuestas', value: '\`!apostar [cant] [gana/pierde] [Nombre#TAG]\` - Apuesta en una partida en vivo.\\n\`!gacha\` - Consigue un campeón (10 coins).\\n\`!mochila\` - Mira tu colección.\\n\`!desencantar\` - Recicla repetidos.\\n\`!reroll [rareza]\` - Fusiona 3 repetidos.\\n\`!shame\` - El muro de la vergüenza.' }
        )`;

content = content.replace(/\.addFields\([\s\S]*?\n        \)/, updatedHelp);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Comando !help actualizado con todos los comandos nuevos.');
