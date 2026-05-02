const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';

let content = fs.readFileSync(path, 'utf8');

// Diccionario de limpieza
const replacements = [
    { from: /Ã¢Å¡â€ Ã¯Â¸Â  Â¡PARTIDA EN VIVO!/g, to: '⚔️ ¡PARTIDA EN VIVO!' },
    { from: /CampeÃ³n:/g, to: 'Campeón:' },
    { from: /Ã¢Ëœâ‚¬Ã¯Â¸Â  Â¡Buenos dÃ­as/g, to: '☀️ ¡Buenos días' },
    { from: /Â¿QuiÃ©n se va a sacar/g, to: '¿Quién se va a sacar' },
    { from: /Ã¢Å¡â€ Ã¯Â¸Â /g, to: '⚔️' },
    { from: /ðŸ”¥ El mÃ¡s tryhard/g, to: '🔥 El más tryhard' },
    { from: /Math.round\(\(topWinrate.soloQ.wins\/\(topWinrate.soloQ.wins\+topWinrate.soloQ.losses\)\)\*100\)\% WR\)/g, to: 'Math.round((topWinrate.soloQ.wins/(topWinrate.soloQ.wins+topWinrate.soloQ.losses))*100)}% WR)' },
    { from: /Actualizado automÃ¡ticamente/g, to: 'Actualizado automáticamente' },
    { from: /Ã°Å¸â€˜Â¤ \*AnÃ³nimo\*/g, to: '👤 *Anónimo*' },
    { from: /AnÃ³nimo/g, to: 'Anónimo' },
    { from: /ElecciÃ³n:/g, to: 'Elección:' },
    { from: /GanÃ³ \*\*(\d+) ðŸ’°\*\*/g, to: 'Ganó **$1 💰**' },
    { from: /result.toUpperCase\(\)\+?DO/g, to: 'result.toUpperCase()}DO' },
    { from: /ðŸ †/g, to: '🏆' },
    { from: /ðŸ’€/g, to: '💀' },
    { from: /ðŸ”„ Remake/g, to: '🔄 Remake' },
    { from: /automÃ¡ticamente\. ðŸ’°/g, to: 'automáticamente. 💰' },
    { from: /âœ¨ Â¡RETO COMPLETADO! âœ¨/g, to: '✨ ¡RETO COMPLETADO! ✨' },
    { from: /Â¡IncreÃ­ble!/g, to: '¡Increíble!' },
    { from: /Ãºltima partida/g, to: 'última partida' },
    { from: /Ã°Å¸â€ Â¹/g, to: '🔹' },
    { from: /Naafiri Coins\*\* ðŸ’°/g, to: 'Naafiri Coins** 💰' },
    { from: /NotificaciÃ³n/g, to: 'Notificación' },
    { from: /Â¡SUBIÃ“ DE RANGO!/g, to: '¡SUBIÓ DE RANGO!' },
    { from: /BAJÃ“ DE RANGO/g, to: 'BAJÓ DE RANGO' }
];

replacements.forEach(rep => {
    content = content.replace(rep.from, rep.to);
});

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js ha sido limpiado y codificado correctamente en UTF-8.');
