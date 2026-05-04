const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

const disenchantCode = `
    if (command === 'desencantar' || command === 'reciclar') {
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory || userEco.inventory.length === 0) {
        return msg.reply('🎒 No tienes nada en tu mochila para desencantar.');
      }

      const grouped = {};
      const toKeep = [];
      let totalGain = 0;
      let itemsRemoved = 0;

      const DUST_VALUES = { 'Común': 5, 'Raro': 15, 'Épico': 50, 'Legendario': 200 };

      for (const item of userEco.inventory) {
        if (!grouped[item.id]) {
          grouped[item.id] = true;
          toKeep.push(item);
        } else {
          totalGain += DUST_VALUES[item.rarity] || 5;
          itemsRemoved++;
        }
      }

      if (itemsRemoved === 0) {
        return msg.reply('✨ No tienes objetos repetidos en tu mochila.');
      }

      await db.collection('economy').updateOne(
        { discordId: msg.author.id },
        { 
          $set: { inventory: toKeep },
          $inc: { coins: totalGain }
        }
      );

      msg.reply(\`♻️ ¡Has desencantado **\${itemsRemoved} objetos** repetidos y has recibido **\${totalGain} Naafiri Coins**! 💰\`);
    }`;

// Insertar el nuevo comando después del bloque de mochila
content = content.replace(/msg\.reply\(\{ embeds: \[embed\] \}\);\s*\}/, `msg.reply({ embeds: [embed] });\n    }${disenchantCode}`);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Comando !desencantar añadido.');
