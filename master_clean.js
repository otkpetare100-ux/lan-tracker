const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';

let content = fs.readFileSync(path, 'utf8');

// Diccionario maestro de limpieza
const cleanMap = [
    // Emojis y símbolos
    { from: /ðŸŽ°/g, to: '🎰' },
    { from: /ðŸ’°/g, to: '💰' },
    { from: /âœ¨/g, to: '✨' },
    { from: /ðŸŽŠ/g, to: '🎊' },
    { from: /Ã¢Â­Â /g, to: '⭐' },
    { from: /ðŸ’œ/g, to: '💜' },
    { from: /ðŸ”¹/g, to: '🔹' },
    { from: /âšª/g, to: '⚪' },
    { from: /ðŸŽ’/g, to: '🎒' },
    { from: /ðŸš«/g, to: '🚫' },
    { from: /âœ…/g, to: '✅' },
    { from: /ðŸª™/g, to: '🪙' },
    { from: /ðŸ¤¡/g, to: '🤡' },
    { from: /Ã¢Â Å’/g, to: '❌' },
    { from: /Ã¢Â Â³/g, to: '⌛' },
    { from: /ðŸ”¥/g, to: '🔥' },
    { from: /ðŸŽ‰/g, to: '🎉' },
    { from: /ðŸ’€/g, to: '💀' },
    { from: /Ã°Å¸â€˜Â¤/g, to: '👤' },
    { from: /ðŸ †/g, to: '🏆' },
    { from: /ðŸ”„/g, to: '🔄' },
    { from: /âœ¨/g, to: '✨' },
    { from: /Ã°Å¸â€ Â¹/g, to: '🔹' },
    { from: /Ã¢Å¡â€ /g, to: '⚔️' },
    { from: /ðŸ“Š/g, to: '📊' },
    { from: /ðŸ“ˆ/g, to: '📈' },

    // Letras con tildes y símbolos de apertura
    { from: /Â¡/g, to: '¡' },
    { from: /Â¿/g, to: '¿' },
    { from: /Ã³/g, to: 'ó' },
    { from: /Ã­/g, to: 'í' },
    { from: /Ã¡/g, to: 'á' },
    { from: /Ã©/g, to: 'é' },
    { from: /Ãº/g, to: 'ú' },
    { from: /Ã‰/g, to: 'É' },
    { from: /Ã“/g, to: 'Ó' },
    { from: /Ã /g, to: 'Á' },
    { from: /Ã‘/g, to: 'Ñ' },
    { from: /Ã±/g, to: 'ñ' },
    { from: /Ã¼/g, to: 'ü' },
    { from: /Â·/g, to: '·' },

    // Casos específicos de palabras
    { from: /estÃ¡/g, to: 'está' },
    { from: /vacÃ­a/g, to: 'vacía' },
    { from: /colecciÃ³n/g, to: 'colección' },
    { from: /revelarÃ¡/g, to: 'revelará' },
    { from: /elecciÃ³n/g, to: 'elección' },
    { from: /AnÃ³nima/g, to: 'Anónima' },
    { from: /AnÃ³nimo/g, to: 'Anónimo' },
    { from: /VergÃ¼enza/g, to: 'Vergüenza' },
    { from: /registrada/g, to: 'registrada' }
];

cleanMap.forEach(rep => {
    content = content.replace(rep.from, rep.to);
});

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js LIMPIO TOTALMENTE.');
