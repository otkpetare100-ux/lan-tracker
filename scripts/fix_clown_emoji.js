const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// Reparar el mensaje de confirmación de apuestas con el emoji de payaso en Unicode
content = content.replace(/¡La elección se revelará al final! [^`]*`/g, 
    '¡La elección se revelará al final! \\uD83E\\uDD21`');

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Confirmación de apuestas LIMPIA.');
