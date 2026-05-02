const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// Corregir "PIERDEDO" por "PERDIDO" y mejorar lógica de visualización de LP
const fixedFunc = `async function notifyBetResults(targetName, result, winners, profileIconId, championId, lpData, kda) {
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
  const actionText = result === 'gana' ? 'GANADO' : 'PERDIDO';
  
  const lpDisplay = lpData ? \`\\n**Puntos:** \${lpData}\` : '\\n**Puntos:** *Actualizando...*';
  const kdaDisplay = kda ? \`\\n**KDA:** \${kda}\` : '';

  const embedBet = new EmbedBuilder()
    .setAuthor({ name: targetName, iconURL: playerIcon })
    .setTitle(\`\${emoji} Resultados de Apuestas\`)
    .setDescription(\`El jugador ha **\${actionText}** la partida.\${kdaDisplay}\${lpDisplay}\\n\\n\${description}\`)
    .setThumbnail(champIcon)
    .setColor(winners.length > 0 ? 0xf1c40f : 0x95a5a6)
    .setTimestamp();

  channel.send({ embeds: [embedBet] });
}`;

content = content.replace(/async function notifyBetResults[\s\S]*?channel\.send\(\{ embeds: \[embedBet\] \}\);\s*\}/, fixedFunc);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js corregido (PERDIDO) y visualización de LP mejorada.');
