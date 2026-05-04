const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

const newFunc = `async function notifyBetResults(targetName, result, winners, profileIconId, championId) {
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
  const embedBet = new EmbedBuilder()
    .setAuthor({ name: targetName, iconURL: playerIcon })
    .setTitle(\`\${emoji} Resultados de Apuestas\`)
    .setDescription(\`El jugador ha **\${result.toUpperCase()}DO** la partida.\\n\\n\${description}\`)
    .setThumbnail(champIcon)
    .setColor(winners.length > 0 ? 0xf1c40f : 0x95a5a6)
    .setTimestamp();

  channel.send({ embeds: [embedBet] });
}`;

// Reemplazo usando expresión regular para capturar toda la función vieja
content = content.replace(/async function notifyBetResults[\s\S]*?channel\.send\(\{ embeds: \[embedBet\] \}\);\s*\}/, newFunc);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ notifyBetResults actualizada con iconos.');
