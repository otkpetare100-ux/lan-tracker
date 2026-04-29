const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

let client = null;
let targetChannelId = process.env.DISCORD_CHANNEL_ID;

const RANK_COLORS = {
  IRON: 0x51484a, BRONZE: 0x8c5230, SILVER: 0x80989d, GOLD: 0xcd8837,
  PLATINUM: 0x4e9996, EMERALD: 0x27a170, DIAMOND: 0x576bce, MASTER: 0x9d5ade,
  GRANDMASTER: 0xd93f3f, CHALLENGER: 0xf4c874
};

function initBot(db) {
  if (!process.env.DISCORD_TOKEN) {
    console.warn('⚠️ No se detectó DISCORD_TOKEN. El bot no iniciará.');
    return;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.on('ready', () => {
    console.log(`✅ Bot conectado como: ${client.user.tag}`);
  });

  // Comandos básicos por mensaje (Prefijo !)
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith('!')) return;

    const args = msg.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'perfil') {
      const slug = args[0]; // Nombre#Tag
      if (!slug) return msg.reply('Uso: `!perfil Nombre#TAG`');
      const [name, tag] = slug.split('#');
      const acc = await db.collection('accounts').findOne({ 
        gameName: { $regex: new RegExp(`^${name}$`, 'i') },
        tagLine: { $regex: new RegExp(`^${tag}$`, 'i') }
      });

      if (!acc) return msg.reply('Jugador no encontrado en el dashboard.');

      const embed = new EmbedBuilder()
        .setTitle(`${acc.gameName}#${acc.tagLine}`)
        .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png`)
        .setColor(RANK_COLORS[acc.soloQ?.tier] || 0xffffff)
        .addFields(
          { name: 'Rango SoloQ', value: acc.soloQ ? `${acc.soloQ.tier} ${acc.soloQ.rank} (${acc.soloQ.leaguePoints} LP)` : 'Unranked', inline: true },
          { name: 'Winrate', value: acc.soloQ ? `${Math.round((acc.soloQ.wins / (acc.soloQ.wins + acc.soloQ.losses)) * 100)}%` : 'N/A', inline: true },
          { name: 'Racha', value: acc.streak > 0 ? `🔥 ${acc.streak} Wins` : acc.streak < 0 ? `❄️ ${Math.abs(acc.streak)} Loss` : '—', inline: true }
        )
        .setFooter({ text: 'LAN Tracker Bot' });

      msg.reply({ embeds: [embed] });
    }

    if (command === 'ladder') {
      const accounts = await db.collection('accounts').find({}).toArray();
      const sorted = accounts.sort((a,b) => (b.soloQ?.leaguePoints || 0) - (a.soloQ?.leaguePoints || 0)).slice(0, 10);
      
      const list = sorted.map((a, i) => `${i+1}. **${a.gameName}** - ${a.soloQ?.tier || 'Unranked'} ${a.soloQ?.rank || ''}`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 de La Perrera')
        .setDescription(list || 'No hay jugadores registrados.')
        .setColor(0xf4c874);

      msg.reply({ embeds: [embed] });
    }

    // --- Fase 1: Vínculo y Economía ---
    
    if (command === 'vincular') {
      const slug = args[0];
      if (!slug) return msg.reply('Uso: `!vincular Nombre#TAG`');
      const [name, tag] = slug.split('#');
      
      const res = await db.collection('accounts').updateOne(
        { gameName: { $regex: new RegExp(`^${name}$`, 'i') }, tagLine: { $regex: new RegExp(`^${tag}$`, 'i') } },
        { $set: { discordId: msg.author.id } }
      );

      if (res.modifiedCount > 0) {
        msg.reply(`✅ ¡Cuenta vinculada! Ahora eres oficialmente **${name}#${tag}**.`);
      } else {
        msg.reply('❌ No encontré esa cuenta en el dashboard.');
      }
    }

    if (command === 'monedas' || command === 'bal') {
      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      const bal = user ? user.coins : 0;
      msg.reply(`💰 Tienes **${bal} Naafiri Coins**. Use \`!diario\` para reclamar más.`);
    }

    if (command === 'diario') {
      const now = new Date();
      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      
      if (user && user.lastDaily && (now - user.lastDaily < 24 * 60 * 60 * 1000)) {
        return msg.reply('⏳ Ya reclamaste tus monedas hoy. Vuelve mañana.');
      }

      await db.collection('economy').updateOne(
        { discordId: msg.author.id },
        { $inc: { coins: 100 }, $set: { lastDaily: now, discordTag: msg.author.tag } },
        { upsert: true }
      );
      msg.reply('🪙 ¡Recibiste **100 Naafiri Coins**! Úsalas sabiamente.');
    }

    if (command === 'shame' || command === 'muro') {
      const accounts = await db.collection('accounts').find({}).toArray();
      const losers = accounts.sort((a,b) => (a.soloQ?.wins / (a.soloQ?.wins + a.soloQ?.losses || 1)) - (b.soloQ?.wins / (b.soloQ?.wins + b.soloQ?.losses || 1))).slice(0, 5);
      
      const list = losers.map((a, i) => `${i+1}. **${a.gameName}** - WR: ${Math.round((a.soloQ?.wins / (a.soloQ?.wins + a.soloQ?.losses || 1)) * 100)}% 🤡`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('🤡 El Muro de la Vergüenza')
        .setDescription(list || 'Todos son pro players por ahora.')
        .setColor(0xd93f3f);

      msg.reply({ embeds: [embed] });
    }

    if (command === 'top_ricos' || command === 'top_coins') {
      const top = await db.collection('economy').find({}).sort({ coins: -1 }).limit(10).toArray();
      const list = top.map((u, i) => `${i+1}. **${u.discordTag || 'Usuario'}** - ${u.coins} 💰`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('💰 Los Más Ricos de la Perrera')
        .setDescription(list || 'Nadie tiene monedas aún.')
        .setColor(0xf1c40f);

      msg.reply({ embeds: [embed] });
    }

    if (command === 'apostar') {
      const amount = parseInt(args[0]);
      const choice = args[1]?.toLowerCase(); // gana / pierde
      const targetSlug = args[2]; // opcional

      if (isNaN(amount) || amount <= 0 || !['gana', 'pierde'].includes(choice)) {
        return msg.reply('Uso: `!apostar [cantidad] [gana/pierde] Nombre#TAG`');
      }

      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!user || user.coins < amount) return msg.reply('❌ No tienes suficientes Naafiri Coins.');

      // Guardar apuesta (esto se procesaría al terminar la partida en proxy.js)
      await db.collection('bets').insertOne({
        discordId: msg.author.id,
        amount,
        choice,
        target: targetSlug,
        status: 'open',
        date: new Date()
      });

      await db.collection('economy').updateOne({ discordId: msg.author.id }, { $inc: { coins: -amount } });
      msg.reply(`✅ Apuesta registrada: **${amount} coins** a que **${choice.toUpperCase()}**. ¡Suerte!`);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

// Función para enviar notificaciones de rango
async function notifyRankChange(data) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const { name, oldRank, newRank, promoted } = data;
  const color = promoted ? 0x00C65E : 0xd93f3f;
  const emoji = promoted ? '🎉' : '💀';
  const action = promoted ? '¡SUBIÓ DE RANGO!' : 'BAJÓ DE RANGO...';

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${action}`)
    .setDescription(`**${name}** ahora es **${newRank}**\n*(Antes: ${oldRank})*`)
    .setColor(color)
    .setTimestamp();

  channel.send({ embeds: [embed] });

  /* 
  // Actualizar Rol si está vinculado (Desactivado temporalmente)
  const acc = await db.collection('accounts').findOne({ gameName: name });
  if (acc && acc.discordId) {
    updateUserRoles(acc.discordId, newRank.split(' ')[0]);
  }
  */
}

async function updateUserRoles(discordId, tier) {
  if (!client) return;
  try {
    const guild = client.guilds.cache.first(); // Asumimos un solo servidor
    if (!guild) return;
    const member = await guild.members.fetch(discordId);
    if (!member) return;

    const roleEnvMap = {
      IRON: 'ROLE_IRON', BRONZE: 'ROLE_BRONZE', SILVER: 'ROLE_SILVER', GOLD: 'ROLE_GOLD',
      PLATINUM: 'ROLE_PLATINUM', EMERALD: 'ROLE_EMERALD', DIAMOND: 'ROLE_DIAMOND',
      MASTER: 'ROLE_MASTER', GRANDMASTER: 'ROLE_GRANDMASTER', CHALLENGER: 'ROLE_CHALLENGER'
    };

    const targetRoleId = process.env[roleEnvMap[tier.toUpperCase()]];
    if (!targetRoleId) return;

    // Quitar otros roles de rango (opcional)
    const allRankRoles = Object.values(roleEnvMap).map(v => process.env[v]).filter(id => id);
    await member.roles.remove(allRankRoles);
    
    // Añadir nuevo rol
    await member.roles.add(targetRoleId);
  } catch (e) {
    console.error('Error actualizando roles:', e);
  }
}

// Alerta de Partida en Vivo
async function notifyLiveGame(acc, gameData) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ ¡PARTIDA EN VIVO!')
    .setDescription(`**${acc.gameName}** acaba de entrar en una partida.\n**Campeón:** ${gameData.championName || 'Desconocido'}`)
    .setColor(0x576bce)
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

// Recordatorio Primera Victoria
async function sendDailyMotivation(db) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('☀️ ¡Buenos días, Perrera!')
    .setDescription('¿Quién se va a sacar la primera victoria hoy? ⚔️\nUsen `!diario` para sus monedas.')
    .setColor(0xf4c874);

  channel.send({ embeds: [embed] });
}

// Resumen Diario
async function sendDailySummary(db) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const accounts = await db.collection('accounts').find({}).toArray();
  if (!accounts.length) return;

  const topWinrate = accounts.sort((a,b) => {
    const wrA = a.soloQ ? a.soloQ.wins / (a.soloQ.wins + a.soloQ.losses) : 0;
    const wrB = b.soloQ ? b.soloQ.wins / (b.soloQ.wins + b.soloQ.losses) : 0;
    return wrB - wrA;
  })[0];

  const embed = new EmbedBuilder()
    .setTitle('📊 Resumen Diario de la Perrera')
    .addFields(
      { name: '🔥 El más tryhard', value: `${topWinrate.gameName} (${Math.round((topWinrate.soloQ.wins/(topWinrate.soloQ.wins+topWinrate.soloQ.losses))*100)}% WR)`, inline: false }
    )
    .setColor(0x576bce)
    .setFooter({ text: 'Actualizado automáticamente' });

  channel.send({ embeds: [embed] });
}

module.exports = { initBot, notifyRankChange, sendDailySummary };
