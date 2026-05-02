const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';

let content = fs.readFileSync(path, 'utf8');

// Diccionario Universal de Limpieza
const cleanMap = [
    // Emojis de sistema y estado
    { from: /Ã¢Å¡Â Ã¯Â¸Â /g, to: '⚠️' },
    { from: /Ã¢Â Å’/g, to: '❌' },
    { from: /Ã¢Â â€žÃ¯Â¸Â /g, to: '❄️' },
    { from: /Ã°Å¸Â â€ /g, to: '🏆' },
    { from: /â Œ/g, to: '❌' },
    { from: /Ã¢Â Â³/g, to: '⌛' },
    { from: /Ã°Å¸Â¤Â /g, to: '🤡' },
    { from: /Ã¢Â­Â /g, to: '⭐' },
    
    // Símbolos de texto y puntuación
    { from: /Â¡/g, to: '¡' },
    { from: /Â¿/g, to: '¿' },
    { from: /Â·/g, to: '·' },
    { from: /â€”/g, to: '—' },
    
    // Palabras específicas con tildes
    { from: /Ãšsalas/g, to: 'Úsalas' },
    { from: /estÃ¡/g, to: 'está' },
    { from: /vacÃ­a/g, to: 'vacía' },
    { from: /vincÃºlate/g, to: 'vincúlate' },
    { from: /revelarÃ¡/g, to: 'revelará' },
    { from: /elecciÃ³n/g, to: 'elección' },
    { from: /automÃ¡ticamente/g, to: 'automáticamente' },
    { from: /Ãºltima partida/g, to: 'última partida' },
    { from: /NotificaciÃ³n/g, to: 'Notificación' },
    { from: /Ã³n/g, to: 'ón' },
    { from: /Ã­a/g, to: 'ía' }
];

cleanMap.forEach(rep => {
    content = content.replace(rep.from, rep.to);
});

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js LIMPIADO DE PUNTA A PUNTA.');
