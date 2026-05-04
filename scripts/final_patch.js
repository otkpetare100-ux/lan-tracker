const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Asegurar !help tenga los nuevos comandos
const newHelpFields = `          { name: '🎮 Diversión y Apuestas', value: '!apostar [cant] [gana/pierde] [Nombre#TAG] - Apuesta en una partida en vivo.\\n!gacha - Gasta 10 coins para conseguir un campeón.\\n!mochila - Mira tu colección de campeones.\\n!desencantar - Recicla tus repetidos por coins.\\n!reroll [rareza] - Fusiona 3 repetidos para obtener uno nuevo (¡con chance de upgrade!).\\n!shame - El muro de la vergüenza.' }`;
content = content.replace(/{ name: '🎮 Diversión y Apuestas'[\s\S]*?}/, newHelpFields);

// 2. Inyectar !reroll al final de los comandos (antes de los admin_)
const rerollCode = `
    if (command === 'reroll' || command === 'fusionar') {
      const rarityArg = args[0] ? args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase() : 'Común';
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory) return msg.reply('🎒 Tu mochila está vacía.');

      const counts = {}; const duplicates = [];
      for (const item of userEco.inventory) {
        if (item.rarity === rarityArg) {
          if (counts[item.id]) duplicates.push(item);
          else counts[item.id] = true;
        }
      }

      if (duplicates.length < 3) return msg.reply(\`❌ Necesitas al menos **3 copias repetidas** de rareza **\${rarityArg}**.\`);

      const toRemove = duplicates.slice(0, 3);
      const rarities = ['Común', 'Raro', 'Épico', 'Legendario'];
      let currentIdx = rarities.indexOf(rarityArg);
      let resultRarity = rarityArg;
      
      const upgradeChance = currentIdx === 0 ? 0.10 : currentIdx === 1 ? 0.15 : currentIdx === 2 ? 0.20 : 0;
      if (Math.random() < upgradeChance) resultRarity = rarities[currentIdx + 1];

      const possibleRewards = GACHA_ITEMS.filter(i => i.rarity === resultRarity && i.type !== 'coins');
      const selected = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];

      let newInv = [...userEco.inventory];
      for (const itemToRemove of toRemove) {
        const idx = newInv.findIndex(i => i.id === itemToRemove.id);
        if (idx > -1) newInv.splice(idx, 1);
      }
      newInv.push({ id: selected.id, name: selected.name, rarity: selected.rarity, date: new Date() });

      await db.collection('economy').updateOne({ discordId: msg.author.id }, { $set: { inventory: newInv } });
      const upgradeMsg = resultRarity !== rarityArg ? ' ✨ **¡UPGRADE!** ✨' : '';
      msg.reply(\`♻️ Has fusionado 3 repetidos **\${rarityArg}** y obtuviste: **\${selected.name}** (\${selected.rarity})\${upgradeMsg}\`);
    }
`;

if (!content.includes('command === \'reroll\'')) {
    content = content.replace(/\/\/ =============================================/, rerollCode + '\n    // =============================================');
}

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js actualizado con !help mejorado y !reroll forzado.');
