const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Actualizar notifyBetResults para incluir LP y KDA
const newBetResultsFunc = `async function notifyBetResults(targetName, result, winners, profileIconId, championId, lpData, kda) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const playerIcon = \`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/\${profileIconId || 0}.png\`;
  const champIcon = championId ? \`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/\${championId}.png\` : null;

  const description = winners.length > 0 
    ? \`**Ganadores:**\\n\${winners.map(w => {
        const userStr = w.anonymous ? '👤 *Anónimo*' : \`<@\${w.discordId}>\`;
        const prize = Math.floor(w.amount * (w.multiplier || 2));
        return \`\${userStr} (Elección: **\${w.choice.toUpperCase()}**) - Ganó **\${prize} 💰**\`;
      }).join('\\n')}\`
    : 'No hubo ganadores esta vez.';

  const emoji = result === 'gana' ? '\\uD83C\\uDFC6' : '💀';
  const lpDisplay = lpData ? \`\\n**Cambio de LP:** \${lpData}\` : '';
  const kdaDisplay = kda ? \`\\n**KDA:** \${kda}\` : '';

  const embedBet = new EmbedBuilder()
    .setAuthor({ name: targetName, iconURL: playerIcon })
    .setTitle(\`\${emoji} Resultados de Apuestas\`)
    .setDescription(\`El jugador ha **\${result.toUpperCase()}DO** la partida.\${kdaDisplay}\${lpDisplay}\\n\\n\${description}\`)
    .setThumbnail(champIcon)
    .setColor(winners.length > 0 ? 0xf1c40f : 0x95a5a6)
    .setTimestamp();

  channel.send({ embeds: [embedBet] });
}`;

content = content.replace(/async function notifyBetResults[\s\S]*?channel\.send\(\{ embeds: \[embedBet\] \}\);\s*\}/, newBetResultsFunc);

// 2. Actualizar !admin_setcoins para soportar roles
const newSetCoinsLogic = `      if (command === 'admin_setcoins') {
        const role = msg.mentions.roles.first();
        const targetUser = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        
        if (isNaN(amount)) return msg.reply('Uso: \`!admin_setcoins [@usuario o @rol] cantidad\`');

        if (role) {
          const members = await msg.guild.members.fetch();
          const roleMembers = members.filter(m => m.roles.cache.has(role.id));
          
          for (const [id, member] of roleMembers) {
            await db.collection('economy').updateOne(
              { discordId: id },
              { $set: { coins: amount, discordTag: member.user.tag } },
              { upsert: true }
            );
          }
          return msg.reply(\`✅ **\${amount} coins** asignadas a los **\${roleMembers.size}** miembros del rol **\${role.name}**.\`);
        } else if (targetUser) {
          await db.collection('economy').updateOne(
            { discordId: targetUser.id },
            { $set: { coins: amount, discordTag: targetUser.tag } },
            { upsert: true }
          );
          return msg.reply(\`✅ Saldo de **\${targetUser.username}** establecido en **\${amount} coins**.\`);
        } else {
          return msg.reply('Uso: \`!admin_setcoins [@usuario o @rol] cantidad\`');
        }
      }`;

content = content.replace(/if \(command === 'admin_setcoins'\) \{[\s\S]*?\n      \}/, newSetCoinsLogic);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js actualizado con soporte para Roles y Estadísticas de Partida.');
