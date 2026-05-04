const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

const newTestBet = `      if (command === 'admin_testbet') {
        const testWinners = [
          { discordId: msg.author.id, amount: 50, multiplier: 2.0, choice: 'gana', anonymous: false }
        ];
        await notifyBetResults('Jugador de Prueba', 'gana', testWinners, 0, 'Naafiri', '+25 LP (Platino I)', '15/2/8');
        return msg.reply('✅ Notificación de apuesta de prueba enviada.');
      }`;

// Reemplazar solo el bloque de admin_testbet
content = content.replace(/if \(command === 'admin_testbet'\) \{[\s\S]*?msg\.reply\('✅ Notificación de apuesta de prueba enviada.'\);\s*\}/, newTestBet);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ admin_testbet actualizado correctamente.');
