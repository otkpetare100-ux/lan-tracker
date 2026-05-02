const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

const rerollCode = `
    if (command === 'reroll' || command === 'fusionar') {
      const rarityArg = args[0] ? args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase() : 'Común';
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory) return msg.reply('🎒 Tu mochila está vacía.');

      // 1. Encontrar duplicados de esa rareza
      const counts = {};
      const duplicates = [];
      for (const item of userEco.inventory) {
        if (item.rarity === rarityArg) {
          if (counts[item.id]) duplicates.push(item);
          else counts[item.id] = true;
        }
      }

      if (duplicates.length < 3) {
        return msg.reply(\`❌ Necesitas al menos **3 copias repetidas** de rareza **\${rarityArg}** para hacer reroll.\`);
      }

      // 2. Tomar 3 duplicados
      const toRemove = duplicates.slice(0, 3);
      
      // 3. Calcular resultado (Probabilidad de subir de rareza)
      const rarities = ['Común', 'Raro', 'Épico', 'Legendario'];
      let currentIdx = rarities.indexOf(rarityArg);
      let resultRarity = rarityArg;
      
      const upgradeChance = currentIdx === 0 ? 0.10 : currentIdx === 1 ? 0.15 : currentIdx === 2 ? 0.20 : 0;
      if (Math.random() < upgradeChance) {
        resultRarity = rarities[currentIdx + 1];
      }

      const possibleRewards = GACHA_ITEMS.filter(i => i.rarity === resultRarity && i.type !== 'coins');
      const selected = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];

      // 4. Actualizar Inventario (Quitar 3, poner 1)
      let newInv = [...userEco.inventory];
      for (const itemToRemove of toRemove) {
        const idx = newInv.findIndex(i => i.id === itemToRemove.id);
        if (idx > -1) newInv.splice(idx, 1);
      }
      newInv.push({ id: selected.id, name: selected.name, rarity: selected.rarity, date: new Date() });

      await db.collection('economy').updateOne(
        { discordId: msg.author.id },
        { $set: { inventory: newInv } }
      );

      const upgradeMsg = resultRarity !== rarityArg ? ' ✨ **¡UPGRADE!** ✨' : '';
      msg.reply(\`♻️ Has fusionado 3 repetidos **\${rarityArg}** y obtuviste: **\${selected.name}** (\${selected.rarity})\${upgradeMsg}\`);
    }`;

content = content.replace(/msg\.reply\(\`♻️ ¡Has desencantado [\s\S]*?\💰\)\;\s*\}/, (match) => match + rerollCode);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Comando !reroll añadido.');
