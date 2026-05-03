const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

let client = null;
let dbInstance = null;
let targetChannelId = process.env.DISCORD_CHANNEL_ID;
let DDRAGON_VERSION = '15.8.1';

// Función para actualizar la versión de Data Dragon desde el bot
async function updateBotDDragonVersion() {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    if (versions && versions.length > 0) {
      DDRAGON_VERSION = versions[0];
    }
  } catch (e) {}
}
updateBotDDragonVersion();
setInterval(updateBotDDragonVersion, 1000 * 60 * 60 * 24);

const RANK_COLORS = {
  IRON: 0x51484a, BRONZE: 0x8c5230, SILVER: 0x80989d, GOLD: 0xcd8837,
  PLATINUM: 0x4e9996, EMERALD: 0x27a170, DIAMOND: 0x576bce, MASTER: 0x9d5ade,
  GRANDMASTER: 0xd93f3f, CHALLENGER: 0xf4c874
};

const TIER_ORDER = {
  CHALLENGER: 9, GRANDMASTER: 8, MASTER: 7,
  DIAMOND: 6, EMERALD: 5, PLATINUM: 4,
  GOLD: 3, SILVER: 2, BRONZE: 1, IRON: 0, UNRANKED: -1,
};
const DIV_ORDER = { I: 4, II: 3, III: 2, IV: 1 };

function isAdmin(userId) {
  return userId === process.env.ADMIN_DISCORD_ID;
}

// Cooldown para !help (5 minutos)
const helpCooldowns = new Map();

// --- SISTEMA DE GACHAPON ---
const GACHA_ITEMS = [
  { id: 'Naafiri', name: 'Naafiri (Base)', rarity: 'Común', weight: 70, img: 'Naafiri_0' },
  { id: 'Aatrox', name: 'Aatrox', rarity: 'Común', weight: 70, img: 'Aatrox_0' },
  { id: 'Yasuo', name: 'Yasuo', rarity: 'Común', weight: 70, img: 'Yasuo_0' },
  { id: 'Zed', name: 'Zed', rarity: 'Común', weight: 70, img: 'Zed_0' },
  { id: 'COINS_50', name: 'Bolsa de 50 Coins', rarity: 'Común', weight: 50, type: 'coins', amount: 50 },
  { id: 'Lux', name: 'Lux Cosmic', rarity: 'Raro', weight: 20, img: 'Lux_15' },
  { id: 'LeeSin', name: 'Lee Sin God Fist', rarity: 'Raro', weight: 20, img: 'LeeSin_11' },
  { id: 'COINS_250', name: 'Cofre de 250 Coins', rarity: 'Raro', weight: 15, type: 'coins', amount: 250 },
  { id: 'Jhin', name: 'Jhin Dark Star', rarity: 'Épico', weight: 8, img: 'Jhin_5' },
  { id: 'Naafiri_Soul', name: 'Naafiri Soul Fighter', rarity: 'Épico', weight: 8, img: 'Naafiri_1' },
  { id: 'COINS_1000', name: 'Tesoro de 1000 Coins', rarity: 'Legendario', weight: 2, type: 'coins', amount: 1000 },
  { id: 'Elemental_Lux', name: 'Lux Elementalista', rarity: 'Legendario', weight: 2, img: 'Lux_7' },
  { id: 'Golden_Naafiri', name: 'Naafiri Dorada (Exclusiva)', rarity: 'Legendario', weight: 2, img: 'Naafiri_0' },
  // Agregados del perfil web para compatibilidad
  { id: 'Garen', name: 'Garen', rarity: 'Común', weight: 0 },
  { id: 'Ashe', name: 'Ashe', rarity: 'Común', weight: 0 },
  { id: 'Lux_Base', name: 'Lux', rarity: 'Común', weight: 0 },
  { id: 'MasterYi', name: 'Master Yi', rarity: 'Común', weight: 0 },
  { id: 'Ezreal', name: 'Ezreal', rarity: 'Raro', weight: 0 },
  { id: 'Vayne', name: 'Vayne', rarity: 'Épico', weight: 0 },
  { id: 'Kaisa', name: 'Kai\'Sa', rarity: 'Épico', weight: 0 },
  { id: 'Teemo', name: 'Teemo Satán', rarity: 'Legendario', weight: 0 }
];


function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRankScore(acc) {
  const soloQ = acc.soloQ;
  if (!soloQ) return -1;
  const tier = TIER_ORDER[soloQ.tier] ?? -1;
  const div  = DIV_ORDER[soloQ.rank]  ?? 0;
  const lp   = soloQ.leaguePoints     || 0;
  return tier * 10000 + div * 1000 + lp;
}

function initBot(db) {
  dbInstance = db;
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

    // Eliminar el comando de forma instantánea
    msg.delete().catch(() => {});

    const args = msg.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help' || command === 'ayuda') {
      const now = Date.now();
      const lastUsed = helpCooldowns.get(msg.author.id) || 0;
      const cooldownAmount = 5 * 60 * 1000;

      if (now - lastUsed < cooldownAmount) {
        const timeLeft = Math.ceil((cooldownAmount - (now - lastUsed)) / 60000);
        return msg.channel.send(`<@${msg.author.id}> ⌛ Por favor, espera **${timeLeft} minuto(s)** para volver a usar el comando de ayuda.`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🐾 Centro de Ayuda - LAN Tracker')
        .setDescription('Pulsa el botón de abajo para ver la guía de comandos de forma privada.')
        .setColor(0x576bce)
        .setFooter({ text: 'Naafiri Bot' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`help_main_${msg.author.id}`)
          .setLabel('Ver Guía de Comandos 📖')
          .setStyle(ButtonStyle.Primary)
      );

      const sentMsg = await msg.channel.send({ content: `<@${msg.author.id}>`, embeds: [embed], components: [row] });
      
      // Auto-borrado preventivo tras 1 minuto
      setTimeout(() => sentMsg.delete().catch(() => {}), 60000);
      return;
    }

    if (command === 'help_admin' || command === 'admin_help') {
      if (!isAdmin(msg.author.id)) return msg.channel.send(`<@${msg.author.id}> 🚫 No tienes permisos de administrador.`);

      const embed = new EmbedBuilder()
        .setTitle('🛠️ Panel de Administración - LAN Tracker')
        .setColor(0xd93f3f)
        .addFields(
          { name: '💰 Gestión de Monedas', value: '`!admin_dar @u cant` - Dar monedas.\n`!admin_quitar @u cant` - Quitar monedas.\n`!admin_setcoins @u cant` - Fijar saldo.\n`!admin_resetall CONFIRMAR` - Resetear TODO.' },
          { name: '🎒 Gestión de Items', value: '`!admin_daritem @u id` - Dar campeón.\n`!admin_clearinv @u` - Vaciar mochila.' },
          { name: '📡 Sistema y Debug', value: '`!admin_scan` - Escaneo manual.\n`!admin_check N#T` - Forzar aviso de partida.\n`!admin_syncroles` - Sincronizar roles de Discord.\n`!admin_purge [n]` - Limpiar mensajes del canal.' },
          { name: '🎭 Notificaciones y Test', value: '`!admin_anuncio [msg]` - Enviar anuncio.\n`!admin_testnotif` - Test partida en vivo.\n`!admin_testbet` - Test resultados apuestas.\n`!admin_testsummary` - Test resumen diario.' },
          { name: '⚖️ Apuestas', value: '`!admin_cancelarapuestas N#T` - Reembolsar apuestas abiertas.' }
        )
        .setFooter({ text: 'Acceso Restringido · Naafiri Admin' });

      return msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }
    if (command === 'desencantar' || command === 'reciclar') {
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory || userEco.inventory.length === 0) {
        return msg.channel.send(`<@${msg.author.id}> 🎒 No tienes nada en tu mochila para desencantar.`);
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
        return msg.channel.send(`<@${msg.author.id}> ✨ No tienes objetos repetidos en tu mochila.`);
      }

      await db.collection('economy').updateOne(
        { discordId: msg.author.id },
        { 
          $set: { inventory: toKeep },
          $inc: { coins: totalGain }
        }
      );

      msg.channel.send(`<@${msg.author.id}> ♻️ ¡Has desencantado **${itemsRemoved} objetos** repetidos y has recibido **${totalGain} Naafiri Coins**! 💰`);
    }

    if (command === 'perfil') {
      let slug = args.join(' '); // Soporta nombres con espacios
      let acc = null;

      if (!slug) {
        // Intentar buscar vinculación automática
        acc = await db.collection('accounts').findOne({ discordId: msg.author.id });
        if (!acc) return msg.channel.send(`<@${msg.author.id}> ❌ No estás vinculado. Usa \`!perfil Nombre#TAG\` o vincúlate con \`!vincular\`.`);
      } else {
        acc = await findAccountBySlug(slug);
      }

      if (!acc) return msg.channel.send(`<@${msg.author.id}> Jugador no encontrado en el dashboard.`);

      const embed = new EmbedBuilder()
        .setTitle(`${acc.gameName}#${acc.tagLine}`)
        .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${acc.profileIconId}.png`)
        .setColor(RANK_COLORS[acc.soloQ?.tier] || 0xffffff)
        .addFields(
          { name: 'Rango SoloQ', value: acc.soloQ ? `${acc.soloQ.tier} ${acc.soloQ.rank} (${acc.soloQ.leaguePoints} LP)` : 'Unranked', inline: true },
          { name: 'Winrate', value: acc.soloQ ? `${Math.round((acc.soloQ.wins / (acc.soloQ.wins + acc.soloQ.losses)) * 100)}%` : 'N/A', inline: true },
          { name: 'Racha', value: acc.streak > 0 ? `🔥 ${acc.streak} Wins` : acc.streak < 0 ? `❄️ ${Math.abs(acc.streak)} Loss` : '—', inline: true }
        )
        .setFooter({ text: 'LAN Tracker Bot' });

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    if (command === 'ladder') {
      const accounts = await db.collection('accounts').find({}).toArray();
      const sorted = accounts.sort((a,b) => getRankScore(b) - getRankScore(a)).slice(0, 10);
      
      const list = sorted.map((a, i) => `${i+1}. **${a.gameName}** - ${a.soloQ?.tier || 'Unranked'} ${a.soloQ?.rank || ''}`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 de La Perrera')
        .setDescription(list || 'No hay jugadores registrados.')
        .setColor(0xf4c874);

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    // --- Fase 1: Vínculo y Economía ---
    
    // Función auxiliar para buscar cuenta por slug
    async function findAccountBySlug(slug) {
      if (!slug || !slug.includes('#')) return null;
      const [rawName, rawTag] = slug.split('#');
      const name = rawName.trim();
      const tag = rawTag.trim();
      
      return await db.collection('accounts').findOne({ 
        gameName: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        tagLine: { $regex: new RegExp(`^${escapeRegex(tag)}$`, 'i') }
      });
    }

    if (command === 'test_notif') {
      if (!isAdmin(msg.author.id)) return;
      await sendDailySummary(dbInstance);
      await sendDailyMotivation(dbInstance);
      return;
    }

    if (command === 'vincular') {
      const slug = args.join(' '); // Soporta nombres con espacios
      if (!slug) return msg.channel.send(`<@${msg.author.id}> Uso: \`!vincular Nombre#TAG\``);
      const acc = await findAccountBySlug(slug);
      if (!acc) return msg.channel.send(`<@${msg.author.id}> ❌ No encontré esa cuenta en el dashboard.`);

      const res = await db.collection('accounts').updateOne(
        { puuid: acc.puuid },
        { $set: { discordId: msg.author.id } }
      );

      await db.collection('economy').updateOne(
        { discordId: msg.author.id },
        { $set: { linkedPuuid: acc.puuid, discordTag: msg.author.tag } },
        { upsert: true }
      );

      if (res.modifiedCount > 0 || res.upsertedCount > 0) {
        msg.channel.send(`<@${msg.author.id}> ✅ ¡Cuenta vinculada! Ahora eres oficialmente **${acc.gameName}#${acc.tagLine}**.`);
      } else {
        msg.channel.send(`<@${msg.author.id}> ❌ No encontré esa cuenta en el dashboard.`);
      }
    }

    if (command === 'monedas' || command === 'bal') {
      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      const bal = user ? user.coins : 0;
      msg.channel.send(`<@${msg.author.id}> 💰 Tienes **${bal} Naafiri Coins**. Use \`!diario\` para reclamar más.`);
    }

    if (command === 'diario') {
      const now = new Date();
      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      
      if (user && user.lastDaily) {
        const diff = now - new Date(user.lastDaily);
        const waitTime = 24 * 60 * 60 * 1000;
        if (diff < waitTime) {
          const remaining = waitTime - diff;
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          return msg.channel.send(`<@${msg.author.id}> ⌛ Ya reclamaste tus monedas hoy. Vuelve en **${hours}h ${minutes}m**.`);
        }
      }

      await db.collection('economy').updateOne({ discordId: msg.author.id }, { $set: { lastDaily: new Date() }, $inc: { coins: 100 } }, { upsert: true });
      msg.channel.send(`<@${msg.author.id}> 💰 ¡Recibiste **100 Naafiri Coins**! Úsalas sabiamente.`);
    }

    if (command === 'pagar' || command === 'enviar') {
      const target = msg.mentions.users.first();
      const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));

      if (!target || isNaN(amount) || amount <= 0) {
        return msg.channel.send(`<@${msg.author.id}> ❌ Uso: \`!pagar @usuario [cantidad]\``);
      }

      if (target.id === msg.author.id) {
        return msg.channel.send(`<@${msg.author.id}> 🚫 No puedes pagarte a ti mismo.`);
      }

      const senderEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!senderEco || senderEco.coins < amount) {
        return msg.channel.send(`<@${msg.author.id}> ❌ No tienes suficientes Naafiri Coins (Saldo: ${senderEco?.coins || 0}).`);
      }

      // Transferencia atómica
      await db.collection('economy').updateOne({ discordId: msg.author.id }, { $inc: { coins: -amount } });
      await db.collection('economy').updateOne(
        { discordId: target.id }, 
        { $inc: { coins: amount }, $set: { discordTag: target.tag } }, 
        { upsert: true }
      );

      msg.channel.send(`<@${msg.author.id}> ✅ ¡Transferencia completada! Has enviado **${amount} coins** a **${target.username}**.`);
    }

    if (command === 'trade' || command === 'cambio') {
      const target = msg.mentions.users.first();
      if (!target || target.id === msg.author.id) return msg.channel.send(`<@${msg.author.id}> ❌ Uso: \`!trade @usuario MiCampeon, SuCampeon\``);

      const parts = args.slice(1).join(' ').split(',').map(p => p.trim());
      if (parts.length < 2) return msg.channel.send(`<@${msg.author.id}> ❌ Indica ambos campeones separados por una coma. Ej: \`!trade @user Lux, Teemo\``);

      const senderEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      const targetEco = await db.collection('economy').findOne({ discordId: target.id });

      if (!senderEco || !senderEco.inventory) return msg.channel.send(`<@${msg.author.id}> ❌ No tienes items en tu mochila.`);
      if (!targetEco || !targetEco.inventory) return msg.channel.send(`<@${msg.author.id}> ❌ El usuario destino no tiene mochila.`);

      // Búsqueda robusta: exacto primero, luego parcial
      const findItem = (inv, name) => {
        const exact = GACHA_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase() && inv.includes(i.id));
        if (exact) return exact;
        return GACHA_ITEMS.find(i => i.name.toLowerCase().includes(name.toLowerCase()) && inv.includes(i.id));
      };

      const myItem = findItem(senderEco.inventory, parts[0]);
      const suItem = findItem(targetEco.inventory, parts[1]);

      if (!myItem) return msg.channel.send(`<@${msg.author.id}> ❌ No tienes a **${parts[0]}** en tu mochila.`);
      if (!suItem) return msg.channel.send(`<@${msg.author.id}> ❌ **${target.username}** no tiene a **${parts[1]}**.`);

      const embed = new EmbedBuilder()
        .setTitle('🤝 Propuesta de Intercambio')
        .setDescription(`**${msg.author.username}** quiere intercambiar:\n\n📤 Te da: **${myItem.name}** (${myItem.rarity})\n📥 Recibe: **${suItem.name}** (${suItem.rarity})\n\n¿Aceptas el trato, **${target.username}**?`)
        .setColor(0x3498db)
        .setFooter({ text: 'Esta oferta expira en 1 minuto.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tr_acc_${msg.author.id}_${target.id}_${myItem.id}_${suItem.id}`).setLabel('Aceptar ✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`tr_rej_${msg.author.id}_${target.id}`).setLabel('Rechazar ❌').setStyle(ButtonStyle.Danger)
      );

      msg.channel.send({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
    }

    if (command === 'web' || command === 'link') {
      const embed = new EmbedBuilder()
        .setTitle('🌐 Tu Perfil Web Premium')
        .setDescription('Pulsa el botón de abajo para generar tu enlace personal. El enlace será privado y este mensaje se eliminará automáticamente.')
        .setColor(0xc89b3c)
        .setFooter({ text: 'Naafiri Web Dashboard' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`web_link_${msg.author.id}`)
          .setLabel('Ver Mi Mochila 🎒')
          .setStyle(ButtonStyle.Primary)
      );

      const sentMsg = await msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed], components: [row] });
      
      // Auto-borrado preventivo tras 1 minuto si no interactúa
      setTimeout(() => sentMsg.delete().catch(() => {}), 60000);
      return;
    }

    if (command === 'shame' || command === 'muro') {
      const accounts = await db.collection('accounts').find({}).toArray();
      const losers = accounts.sort((a,b) => (a.soloQ?.wins / (a.soloQ?.wins + a.soloQ?.losses || 1)) - (b.soloQ?.wins / (b.soloQ?.wins + b.soloQ?.losses || 1))).slice(0, 5);
      
      const list = losers.map((a, i) => `${i+1}. **${a.gameName}** - WR: ${Math.round((a.soloQ?.wins / (a.soloQ?.wins + a.soloQ?.losses || 1)) * 100)}% 🤡`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('🤡 El Muro de la Vergüenza')
        .setDescription(list || 'Todos son pro players por ahora.')
        .setColor(0xd93f3f);

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    if (command === 'top_ricos' || command === 'top_coins') {
      const top = await db.collection('economy').find({}).sort({ coins: -1 }).limit(10).toArray();
      const list = top.map((u, i) => `${i+1}. **${u.discordTag || 'Usuario'}** - ${u.coins} 💰`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('💰 Los Más Ricos de la Perrera')
        .setDescription(list || 'Nadie tiene monedas aún.')
        .setColor(0xf1c40f);

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    if (command === 'ludopata' || command === 'bets') {
      const targetUser = msg.mentions.users.first() || msg.author;
      const bets = await db.collection('bets').find({ discordId: targetUser.id }).toArray();

      if (bets.length === 0) {
        return msg.channel.send(`<@${msg.author.id}> ${targetUser.id === msg.author.id ? 'No has' : 'Este usuario no ha'} realizado ninguna apuesta todavía. 🎰`);
      }

      const wins = bets.filter(b => b.status === 'won').length;
      const losses = bets.filter(b => b.status === 'lost').length;
      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
      
      // Calcular balance neto
      let netProfit = 0;
      bets.forEach(b => {
        if (b.status === 'won') netProfit += Math.floor(b.amount * (b.multiplier || 2)) - b.amount;
        if (b.status === 'lost') netProfit -= b.amount;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎰 Perfil de Ludópata: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '🏆 Ganadas', value: `${wins}`, inline: true },
          { name: '💀 Perdidas', value: `${losses}`, inline: true },
          { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
          { name: '💰 Balance Neto', value: `${netProfit > 0 ? '+' : ''}${netProfit} 💰`, inline: false }
        )
        .setColor(netProfit >= 0 ? 0x2ecc71 : 0xe74c3c)
        .setFooter({ text: 'Naafiri Bot · LAN Tracker' });

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    if (command === 'apostar') {
      const isAnonymous = args.some(arg => arg.toLowerCase() === 'anonimo');
      const filteredArgs = args.filter(arg => arg.toLowerCase() !== 'anonimo');
      
      const amount = parseInt(filteredArgs[0]);
      const choice = filteredArgs[1]?.toLowerCase();
      const targetSlug = filteredArgs.slice(2).join(' ');

      if (isNaN(amount) || amount <= 0 || !['gana', 'pierde'].includes(choice) || !targetSlug) {
        return msg.channel.send(`<@${msg.author.id}> ❌ Uso: \`!apostar [cantidad] [gana/pierde] Nombre#TAG [anonimo]\``);
      }

      const targetAcc = await findAccountBySlug(targetSlug);
      if (!targetAcc) return msg.channel.send(`<@${msg.author.id}> ❌ Ese jugador no está registrado en el dashboard.`);

      // 1. Calcular multiplicador dinámico basado en Winrate
      let multiplier = 2.0;
      if (targetAcc.soloQ && (targetAcc.soloQ.wins + targetAcc.soloQ.losses) > 0) {
        const totalGames = targetAcc.soloQ.wins + targetAcc.soloQ.losses;
        const wr = (targetAcc.soloQ.wins / totalGames) * 100;
        if (wr > 60) multiplier = 1.5; // Favorito
        else if (wr < 45) multiplier = 3.0; // Underdog
      }

      // 2. Validación de tiempo de apuesta (5 min desde el aviso en Discord)
      if (targetAcc.liveGameStartedAt) {
        const now = new Date();
        const startedAt = new Date(targetAcc.liveGameStartedAt);
        const diffMs = now - startedAt;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins >= 5) {
          return msg.channel.send(`<@${msg.author.id}> ❌ **Demasiado tarde.** El aviso de partida de **${targetAcc.gameName}** salió hace ${diffMins} minutos. Solo se permite apostar durante los primeros 5 minutos.`);
        }
      } else {
        return msg.channel.send(`<@${msg.author.id}> ❌ No detecto que **${targetAcc.gameName}** esté en una partida activa ahora mismo.`);
      }

      const existingBet = await db.collection('bets').findOne({ discordId: msg.author.id, targetPuuid: targetAcc.puuid, status: 'open' });
      if (existingBet) return msg.channel.send(`<@${msg.author.id}> ⚠️ Ya tienes una apuesta activa por este jugador en esta partida.`);

      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!user || user.coins < amount) return msg.channel.send(`<@${msg.author.id}> ❌ No tienes suficientes Naafiri Coins.`);

      // Guardar apuesta
      if (isAnonymous) msg.delete().catch(() => {});
      
      await db.collection('bets').insertOne({
        discordId: msg.author.id,
        amount,
        choice,
        targetPuuid: targetAcc.puuid,
        targetName: `${targetAcc.gameName}#${targetAcc.tagLine}`,
        status: 'open',
        anonymous: isAnonymous,
        multiplier: multiplier,
        date: new Date()
      });

      await db.collection('economy').updateOne({ discordId: msg.author.id }, { $inc: { coins: -amount } });
      
      const revealMsg = isAnonymous ? '¡La elección se revelará al final!' : `has apostado a que **${choice}**`;
      msg.channel.send(`<@${msg.author.id}> ✅ Apuesta registrada ${isAnonymous ? '(Anónima)' : ''}: **${amount} coins** (Multiplicador: **${multiplier}x**). ${revealMsg} 🤡`);
    }

    if (command === 'gacha' || command === 'tiro') {
      const COST = 10;
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });

      if (!userEco || userEco.coins < COST) {
        return msg.channel.send(`<@${msg.author.id}> ❌ No tienes suficientes coins. El tiro de Gachapon cuesta **${COST} 💰**.`);
      }

      // Sistema de Pesos para Probabilidades
      const totalWeight = GACHA_ITEMS.reduce((sum, item) => sum + item.weight, 0);
      
      // Calcular porcentajes por rareza
      const rarityWeights = {};
      GACHA_ITEMS.forEach(item => {
        rarityWeights[item.rarity] = (rarityWeights[item.rarity] || 0) + item.weight;
      });
      const probabilitiesStr = Object.entries(rarityWeights)
        .map(([rarity, weight]) => `**${rarity}:** ${((weight / totalWeight) * 100).toFixed(1)}%`)
        .join('  ·  ');

      let random = Math.random() * totalWeight;
      let selected = GACHA_ITEMS[0];

      for (const item of GACHA_ITEMS) {
        if (random < item.weight) {
          selected = item;
          break;
        }
        random -= item.weight;
      }

      // Guardar Recompensa
      if (selected.type === 'coins') {
        await db.collection('economy').updateOne(
          { discordId: msg.author.id },
          { $inc: { coins: -COST + selected.amount } }
        );
      } else {
        await db.collection('economy').updateOne(
          { discordId: msg.author.id },
          { 
            $inc: { coins: -COST },
            $addToSet: { inventory: { id: selected.id, name: selected.name, rarity: selected.rarity, date: new Date() } }
          }
        );
      }

      const color = selected.rarity === 'Legendario' ? 0xf1c40f : selected.rarity === 'Épico' ? 0x9b59b6 : selected.rarity === 'Raro' ? 0x3498db : 0x95a5a6;

      // Probabilidades de monedas por separado
      const coinItems = GACHA_ITEMS.filter(i => i.type === 'coins');
      const coinsStr = coinItems.map(i => `**${i.name}:** ${((i.weight / totalWeight) * 100).toFixed(1)}%`).join('  ·  ');

      const embedGacha = new EmbedBuilder()
        .setTitle(`🎰 ¡GACHAPON DE LA PERRERA!`)
        .setDescription(`¡Has obtenido **${selected.name}**!\n\n✨ Rareza: **${selected.rarity}**${selected.type === 'coins' ? `\n💰 ¡Has ganado **${selected.amount} coins**!` : ''}`)
        .addFields(
          { name: '📈 Probabilidades por Rareza', value: probabilitiesStr },
          { name: '💰 Probabilidades de Monedas', value: coinsStr }
        )
        .setImage(selected.type === 'coins' ? 'https://static.wikia.nocookie.net/leagueoflegends/images/1/1b/Gold_icon.png' : `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${selected.img}.jpg`)
        .setColor(color)
        .setFooter({ text: `Gastaste ${COST} coins · Saldo restante: ${userEco.coins - COST + (selected.type === 'coins' ? selected.amount : 0)} 💰 · Naafiri Bot` });

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embedGacha] });

      if (selected.rarity === 'Legendario') {
        msg.channel.send(`🎊 ¡ATENCIÓN! **${msg.author.username}** acaba de conseguir un objeto **LEGENDARIO**: **${selected.name}**! 🎊`);
      }
    }

    if (command === 'mochila' || command === 'inv') {
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory || userEco.inventory.length === 0) {
        return msg.channel.send(`<@${msg.author.id}> 🎒 Tu mochila está vacía. ¡Usa \`!gacha\` para empezar tu colección!`);
      }

      // Agrupar items duplicados y contar cantidad
      const grouped = {};
      for (const item of userEco.inventory) {
        if (!grouped[item.id]) grouped[item.id] = { ...item, count: 0 };
        grouped[item.id].count++;
      }

      const items = Object.values(grouped).map(item => {
        const icon = item.rarity === 'Legendario' ? '⭐' : item.rarity === 'Épico' ? '💜' : item.rarity === 'Raro' ? '🔹' : '⚪';
        const qty = item.count > 1 ? ` **x${item.count}**` : '';
        return `${icon} **${item.name}**${qty} (${item.rarity})`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🎒 Mochila de ${msg.author.username}`)
        .setDescription(items)
        .setColor(0x2ecc71);

      msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
    }

    
    if (command === 'reroll' || command === 'fusionar') {
      const rarityArg = args[0] ? args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase() : 'Común';
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory) return msg.channel.send(`<@${msg.author.id}> 🎒 Tu mochila está vacía.`);

      const counts = {}; const duplicates = [];
      for (const item of userEco.inventory) {
        if (item.rarity === rarityArg) {
          if (counts[item.id]) duplicates.push(item);
          else counts[item.id] = true;
        }
      }

      if (duplicates.length < 3) return msg.channel.send(`<@${msg.author.id}> ❌ Necesitas al menos **3 copias repetidas** de rareza **${rarityArg}**.`);

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
      msg.channel.send(`<@${msg.author.id}> ♻️ Has fusionado 3 repetidos **${rarityArg}** y obtuviste: **${selected.name}** (${selected.rarity})${upgradeMsg}`);
    }

    // =============================================
    // --- COMANDOS ADMIN (solo ADMIN_DISCORD_ID) ---
    // =============================================
    if (command.startsWith('admin_')) {
      if (!isAdmin(msg.author.id)) {
        return msg.channel.send(`<@${msg.author.id}> 🚫 No tienes permisos de administrador.`);
      }

      // !admin_dar @usuario cantidad
      if (command === 'admin_dar') {
        const target = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        if (!target || isNaN(amount) || amount <= 0)
          return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_dar @usuario cantidad\``);
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $inc: { coins: amount }, $set: { discordTag: target.tag } },
          { upsert: true }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ **+${amount} coins** dados a ${target.username}.`);
      }

      // !admin_quitar @usuario cantidad
      if (command === 'admin_quitar') {
        const target = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        if (!target || isNaN(amount) || amount <= 0)
          return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_quitar @usuario cantidad\``);
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $inc: { coins: -amount } }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ **-${amount} coins** quitados a ${target.username}.`);
      }

      // !admin_setcoins @usuario cantidad
            if (command === 'admin_setcoins') {
        const role = msg.mentions.roles.first();
        const targetUser = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        
        if (isNaN(amount)) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_setcoins [@usuario o @rol] cantidad\``);

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
          return msg.channel.send(`<@${msg.author.id}> ✅ **${amount} coins** asignadas a los **${roleMembers.size}** miembros del rol **${role.name}**.`);
        } else if (targetUser) {
          await db.collection('economy').updateOne(
            { discordId: targetUser.id },
            { $set: { coins: amount, discordTag: targetUser.tag } },
            { upsert: true }
          );
          return msg.channel.send(`<@${msg.author.id}> ✅ Saldo de **${targetUser.username}** establecido en **${amount} coins**.`);
        } else {
          return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_setcoins [@usuario o @rol] cantidad\``);
        }
      }

      // !admin_resetdiario @usuario
      if (command === 'admin_resetdiario') {
        const target = msg.mentions.users.first();
        if (!target) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_resetdiario @usuario\``);
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $unset: { lastDaily: '' } }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ Cooldown de diario reseteado para **${target.username}**.`);
      }

      if (command === 'admin_daritem') {
        const target = msg.mentions.users.first();
        const itemId = args[1];
        const item = GACHA_ITEMS.find(i => i.id === itemId);
        if (!target || !item) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_daritem @usuario <itemId>\``);
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $addToSet: { inventory: { id: item.id, name: item.name, rarity: item.rarity, date: new Date() } } },
          { upsert: true }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ Item **${item.name}** (${item.rarity}) dado a **${target.username}**.`);
      }

      if (command === 'admin_scan') {
        const accounts = await db.collection('accounts').find({}).toArray();
        const statusMsg = await msg.channel.send(`<@${msg.author.id}> 🔍 Escaneando partidas en vivo para **${accounts.length}** cuentas...`);
        
        let found = 0;
        let results = [];

        for (const acc of accounts) {
          try {
            const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${acc.puuid.trim()}`;
            const res = await fetch(url, {
              headers: {
                "X-Riot-Token": process.env.RIOT_API_KEY.trim(),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept-Language": "es-ES,es;q=0.9"
              }
            });
            if (res.ok) {
              found++;
              results.push(`✅ **${acc.gameName}**: En partida`);
            } else {
              results.push(`💤 **${acc.gameName}**: No está en partida`);
            }
          } catch (e) {
            results.push(`❌ **${acc.gameName}**: Error de conexión`);
          }
        }

        await statusMsg.edit(`📊 **Resultado del Escaneo:**\n${results.join('\n')}\n\nTotal en vivo: **${found}**`);
        return;
      }

      if (command === 'admin_debug_key') {
        const key = process.env.RIOT_API_KEY || 'NO DEFINIDA';
        const masked = key.length > 10 ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'Muy corta';
        return msg.channel.send(`<@${msg.author.id}> 🔑 **Debug Key:**\n- Máscara: \`${masked}\`\n- Longitud: \`${key.length}\`\n- Variable ENV: \`${process.env.RIOT_API_KEY ? 'Detectada ✅' : 'No detectada ❌'}\``);
      }

      if (command === 'admin_testnotif') {
        const testAcc = { gameName: 'Jugador de Prueba', tagLine: 'LAN' };
        const testData = { championName: 'Naafiri', championId: 'Naafiri' };
        await notifyLiveGame(testAcc, testData);
        return msg.channel.send(`<@${msg.author.id}> ✅ Notificación de partida en vivo de prueba enviada.`);
      }

      if (command === 'admin_testsummary') {
        await sendDailySummary(db);
        return msg.channel.send(`<@${msg.author.id}> ✅ Resumen diario de prueba enviado.`);
      }

            if (command === 'admin_testbet') {
        const testWinners = [
          { discordId: msg.author.id, amount: 50, multiplier: 2.0, choice: 'gana', anonymous: false }
        ];
        const testLp = { tier: 'EMERALD', rank: 'II', lp: 74, diff: 38 };
        const testHighlights = {
          mvp: { name: 'BODKIN ARROW', champion: 'Vi' },
          topDamage: { name: 'KaisaPlayer', champion: 'Kaisa', value: 42500 },
          topVision: { name: 'SupportGod', champion: 'Thresh', value: 85 },
          topGold: { name: 'BODKIN ARROW', champion: 'Vi', value: 18200 }
        };
        await notifyBetResults('BODKIN ARROW#BHR', 'gana', testWinners, 0, 'Vi', testLp, '18/1/9', DDRAGON_VERSION, 1, 420, testHighlights);
        return msg.channel.send(`<@${msg.author.id}> ✅ Notificación de prueba con MVP y logros enviada.`);
      }

      if (command === 'admin_check') {
        const slug = args.join(' ');
        if (!slug) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_check Nombre#TAG\``);
        
        const acc = await findAccountBySlug(slug);
        if (!acc) return msg.channel.send(`<@${msg.author.id}> ❌ Jugador no encontrado en el dashboard.`);

        const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${acc.puuid.trim()}`;
        const res = await fetch(url, {
          headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() }
        });

        if (res.ok) {
          const game = await res.json();
          // Obtener nombre del campeón
          const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
          const champData = await champRes.json();
          const me = game.participants.find(p => p.puuid === acc.puuid);
          const champName = me ? (Object.values(champData.data).find(c => c.key == me.championId)?.name || 'Desconocido') : 'Desconocido';

          const champKey = Object.keys(champData.data).find(key => champData.data[key].key == me.championId); 
          const cName = champKey ? champData.data[champKey].name : 'Desconocido'; 
          
          const sentMsg = await notifyLiveGame(acc, { championName: cName, championId: champKey });
          
          if (sentMsg) {
            setTimeout(() => {
              sentMsg.delete().catch(() => {});
            }, 5 * 60 * 1000);
          }

          return msg.channel.send(`<@${msg.author.id}> ✅ **${acc.gameName}** está en partida. Notificación enviada.`);
        } else {
          return msg.channel.send(`<@${msg.author.id}> 💤 **${acc.gameName}** no parece estar en partida ahora mismo.`);
        }
      }

      // !admin_clearinv @usuario
      if (command === 'admin_clearinv') {
        const target = msg.mentions.users.first();
        if (!target) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_clearinv @usuario\``);
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $set: { inventory: [] } }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ Inventario de **${target.username}** vaciado.`);
      }

      // !admin_anuncio [mensaje]
      if (command === 'admin_anuncio') {
        const message = args.join(' ');
        if (!message) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_anuncio [mensaje]\``);
        const embed = new EmbedBuilder()
          .setTitle('📢 ANUNCIO OFICIAL')
          .setDescription(message)
          .setColor(0xf4c874)
          .setTimestamp()
          .setFooter({ text: 'LAN Tracker Bot' });
        await msg.channel.send({ embeds: [embed] });
        return msg.delete().catch(() => {});
      }

      // !admin_stats
      if (command === 'admin_stats') {
        const totalUsers = await db.collection('economy').countDocuments();
        const richest = await db.collection('economy').find({}).sort({ coins: -1 }).limit(1).toArray();
        const allCoins = await db.collection('economy').aggregate([
          { $group: { _id: null, total: { $sum: '$coins' } } }
        ]).toArray();
        const totalItems = await db.collection('economy').aggregate([
          { $project: { count: { $size: { $ifNull: ['$inventory', []] } } } },
          { $group: { _id: null, total: { $sum: '$count' } } }
        ]).toArray();
        const embed = new EmbedBuilder()
          .setTitle('📊 Estadísticas Globales — Admin')
          .addFields(
            { name: '👥 Usuarios registrados', value: `${totalUsers}`, inline: true },
            { name: '💰 Coins en circulación', value: `${allCoins[0]?.total || 0}`, inline: true },
            { name: '🎰 Items en inventarios', value: `${totalItems[0]?.total || 0}`, inline: true },
            { name: '🏆 Usuario más rico', value: richest[0] ? `${richest[0].discordTag} — ${richest[0].coins} coins` : 'N/A', inline: false }
          )
          .setColor(0x576bce);
        return msg.channel.send({ content: `<@${msg.author.id}>`,  embeds: [embed] });
      }

      // !admin_cancelarApuestas Nombre#TAG
      if (command === 'admin_cancelarapuestas') {
        const slug = args.join(' ');
        if (!slug) return msg.channel.send(`<@${msg.author.id}> Uso: \`!admin_cancelarApuestas Nombre#TAG\``);
        const [name, tag] = slug.split('#');
        const acc = await db.collection('accounts').findOne({
          gameName: { $regex: new RegExp(`^${name}$`, 'i') },
          tagLine:  { $regex: new RegExp(`^${tag}$`, 'i') }
        });
        if (!acc) return msg.channel.send(`<@${msg.author.id}> ❌ Jugador no encontrado en el dashboard.`);
        const openBets = await db.collection('bets').find({ targetPuuid: acc.puuid, status: 'open' }).toArray();
        if (!openBets.length) return msg.channel.send(`<@${msg.author.id}> No hay apuestas abiertas para ese jugador.`);
        for (const bet of openBets) {
          await db.collection('economy').updateOne(
            { discordId: bet.discordId },
            { $inc: { coins: bet.amount } }
          );
        }
        await db.collection('bets').updateMany(
          { targetPuuid: acc.puuid, status: 'open' },
          { $set: { status: 'cancelled' } }
        );
        return msg.channel.send(`<@${msg.author.id}> ✅ **${openBets.length}** apuesta(s) canceladas y reembolsadas para **${acc.gameName}#${acc.tagLine}**.`);
      }

      // !admin_resetAll CONFIRMAR
      if (command === 'admin_resetall') {
        if (args[0] !== 'CONFIRMAR') {
          return msg.channel.send(`<@${msg.author.id}> ⚠️ Esto pondrá a **0 coins** a TODOS los usuarios.\nPara confirmar escribe: \`!admin_resetAll CONFIRMAR\``);
        }
        const result = await db.collection('economy').updateMany({}, { $set: { coins: 0 } });
        return msg.channel.send(`<@${msg.author.id}> ✅ Reset global completado. **${result.modifiedCount}** usuario(s) puestos a 0 coins.`);
      }

      // !admin_purge [cantidad]
      if (command === 'admin_purge') {
        const amount = args[0] ? parseInt(args[0]) : 100;
        if (isNaN(amount) || amount <= 0 || amount > 100) {
          return msg.channel.send(`<@${msg.author.id}> ⚠️ Elija un número entre 1 y 100.`);
        }

        try {
          // Eliminar mensajes (filtrando los de más de 14 días automáticamente)
          const deleted = await msg.channel.bulkDelete(amount, true);
          const confirm = await msg.channel.send(`✅ Se han eliminado **${deleted.size}** mensajes.`);
          setTimeout(() => confirm.delete().catch(() => {}), 5000);
        } catch (e) {
          console.error('[Purge Error]', e);
          msg.channel.send(`<@${msg.author.id}> ❌ Error al intentar borrar mensajes. (Nota: Discord no permite borrar masivamente mensajes de más de 14 días).`);
        }
      }
      // !admin_syncroles
      if (command === 'admin_syncroles') {
        const accounts = await db.collection('accounts').find({ discordId: { $exists: true } }).toArray();
        msg.channel.send(`<@${msg.author.id}> 🔄 Sincronizando roles para **${accounts.length}** usuarios...`);
        
        let success = 0;
        for (const acc of accounts) {
          const tier = acc.soloQ?.tier;
          if (tier) {
            const ok = await updateUserRoles(acc.discordId, tier);
            if (ok) success++;
          }
        }
        return msg.channel.send(`✅ Sincronización completada: **${success}/${accounts.length}** actualizados.`);
      }
    }

  });

  // --- MANEJO DE INTERACCIONES (BOTONES Y MODALS) ---
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        const parts = interaction.customId.split('_');
        const action = parts[0];

        if (action === 'help') {
          const userId = parts[2];
          if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Solo el autor del comando puede ver esta ayuda.', ephemeral: true });
          }

          const helpEmbed = new EmbedBuilder()
            .setTitle('🐾 Guía de Comandos - LAN Tracker')
            .setDescription('¡Bienvenido a la perrera! Aquí tienes todo lo que puedes hacer:')
            .addFields(
              { name: '👤 Perfil y Rango', value: '`!perfil [Nombre#TAG]` - Mira tu rango.\n`!stats [Nombre#TAG]` - Estadísticas.\n`!vincular Nombre#TAG` - Vincula tu cuenta.\n`!ladder` - Top 10 jugadores.' },
              { name: '💰 Economía', value: '`!monedas` - Mira tu saldo.\n`!diario` - Reclama 100 coins.\n`!pagar @usuario [cant]` - Envía monedas.\n`!top_ricos` - Top 10 ricos.' },
              { name: '🎮 Diversión', value: '`!apostar` - Apuesta.\n`!trade @u mio, suyo` - Trade.\n`!gacha` - Nuevo campeón.\n`!mochila` - Tu colección.\n`!web` - Perfil Premium.' }
            )
            .setColor(0x576bce)
            .setFooter({ text: 'Naafiri Bot' });

          await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
          return interaction.message.delete().catch(() => {});
        }

        if (action === 'web') {
          const userId = parts[2];
          if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Solo el autor del comando puede generar su link.', ephemeral: true });
          }
          const url = `https://lan-tracker-production.up.railway.app/perfil/${userId}`;
          await interaction.reply({ 
            content: `🔗 Aquí tienes tu perfil privado:\n${url}`, 
            ephemeral: true 
          });
        // Eliminar el mensaje público original
          return interaction.message.delete().catch(() => {});
        }

        const parts_bet = interaction.customId.split('_');
        const act = parts_bet[0];
        const choice = parts_bet[1];
        const puuid = parts_bet.slice(2).join('_');

        if (act === 'bet') {
          // Obtener saldo del usuario para mostrarlo en el modal
          const userEco = await dbInstance.collection('economy').findOne({ discordId: interaction.user.id });
          const currentCoins = userEco ? userEco.coins : 0;

          const modal = new ModalBuilder()
            .setCustomId(`modal_bet_${choice}_${puuid}`)
            .setTitle(`Apuesta: ${choice.toUpperCase()} (Saldo: ${currentCoins})`);

          const amountInput = new TextInputBuilder()
            .setCustomId('bet_amount')
            .setLabel(`¿Cuánto apostar? (Saldo: ${currentCoins})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Ej: 100 (Tienes ${currentCoins})`)
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
          modal.addComponents(firstActionRow);

          await interaction.showModal(modal);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        const parts = interaction.customId.split('_');
        const [type, action, choice] = parts;
        const puuid = parts.slice(3).join('_');

        if (type !== 'modal' || action !== 'bet') return;

        const amount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
        if (isNaN(amount) || amount <= 0) {
          return interaction.reply({ content: '❌ Cantidad inválida. Debe ser un número mayor a 0.', ephemeral: true });
        }

        const targetAcc = await dbInstance.collection('accounts').findOne({ puuid: puuid.trim() });
        if (!targetAcc) return interaction.reply({ content: `❌ El jugador con ID \`${puuid.substring(0,8)}...\` ya no está registrado o hubo un error de sesión.`, ephemeral: true });

        // Validar tiempo (5 min)
        if (targetAcc.liveGameStartedAt) {
          const now = new Date();
          const startedAt = new Date(targetAcc.liveGameStartedAt);
          if ((now - startedAt) / 60000 >= 5) {
            return interaction.reply({ content: `❌ **Demasiado tarde.** La partida empezó hace más de 5 minutos.`, ephemeral: true });
          }
        } else {
          return interaction.reply({ content: '❌ No detecto que el jugador esté en partida ahora mismo.', ephemeral: true });
        }

        // Validar saldo
        const user = await dbInstance.collection('economy').findOne({ discordId: interaction.user.id });
        if (!user || user.coins < amount) {
          return interaction.reply({ content: `❌ No tienes suficientes Naafiri Coins (Saldo: ${user?.coins || 0}).`, ephemeral: true });
        }

        // Validar si ya tiene apuesta
        const existing = await dbInstance.collection('bets').findOne({ discordId: interaction.user.id, targetPuuid: puuid.trim(), status: 'open' });
        if (existing) {
          return interaction.reply({ content: '⚠️ Ya tienes una apuesta activa por este jugador.', ephemeral: true });
        }

        // Calcular multiplicador
        let multiplier = 2.0;
        if (targetAcc.soloQ && (targetAcc.soloQ.wins + targetAcc.soloQ.losses) > 0) {
          const wr = (targetAcc.soloQ.wins / (targetAcc.soloQ.wins + targetAcc.soloQ.losses)) * 100;
          if (wr > 60) multiplier = 1.5;
          else if (wr < 45) multiplier = 3.0;
        }

        // Registrar apuesta
        await dbInstance.collection('bets').insertOne({
          discordId: interaction.user.id,
          amount,
          choice,
          targetPuuid: puuid,
          targetName: `${targetAcc.gameName}#${targetAcc.tagLine}`,
          status: 'open',
          multiplier: multiplier,
          date: new Date()
        });

        await dbInstance.collection('economy').updateOne({ discordId: interaction.user.id }, { $inc: { coins: -amount } });

        await interaction.reply({ 
          content: `✅ **Apuesta registrada con éxito!**\n💰 **Cantidad:** ${amount} coins\n📈 **Multiplicador:** ${multiplier}x\n🎯 **Elección:** Que el jugador **${choice.toUpperCase()}**`, 
          ephemeral: true 
        });
      }

      // --- MANEJO DE TRADE ---
      if (interaction.isButton() && interaction.customId.startsWith('tr_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const senderId = parts[2];
        const targetId = parts[3];
        const myItemId = parts[4];
        const suItemId = parts[5];

        if (interaction.user.id !== targetId) {
          return interaction.reply({ content: '❌ Solo la persona que recibe la oferta puede responder.', ephemeral: true });
        }

        if (action === 'rej') {
          await interaction.update({ content: '❌ Intercambio rechazado.', embeds: [], components: [] });
          return;
        }

        if (action === 'acc') {
          // Bloquear click doble
          await interaction.deferUpdate();

          const sEco = await dbInstance.collection('economy').findOne({ discordId: senderId });
          const tEco = await dbInstance.collection('economy').findOne({ discordId: targetId });

          if (!sEco.inventory.includes(myItemId) || !tEco.inventory.includes(suItemId)) {
            return interaction.editReply({ content: '❌ Uno de los items ya no está disponible.', embeds: [], components: [] });
          }

          // Realizar intercambio
          const newSInv = sEco.inventory.filter(id => id !== myItemId);
          newSInv.push(suItemId);
          const newTInv = tEco.inventory.filter(id => id !== suItemId);
          newTInv.push(myItemId);

          await dbInstance.collection('economy').updateOne({ discordId: senderId }, { $set: { inventory: newSInv, discordTag: interaction.user.tag } });
          await dbInstance.collection('economy').updateOne({ discordId: targetId }, { $set: { inventory: newTInv, discordTag: interaction.user.tag } });

          await interaction.editReply({ 
            content: `✅ **¡Intercambio realizado con éxito!**\n🤝 <@${senderId}> y <@${targetId}> han intercambiado sus campeones.`, 
            embeds: [], 
            components: [] 
          });
        }
      }
    } catch (e) {
      console.error('[Interaction Error]', e);
      if (interaction.isRepliable()) {
        interaction.reply({ content: '❌ Ocurrió un error al procesar tu apuesta.', ephemeral: true }).catch(() => {});
      }
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

  const queueName = promoted ? 'Rank Up' : 'Rank Down';
  const title = `${queueName} for ${name}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .addFields(
      { name: 'Rango Actual', value: newRank, inline: true },
      { name: 'Rango Anterior', value: oldRank, inline: true }
    )
    .setColor(color)
    .setTimestamp();

  channel.send({ embeds: [embed] });

  // Actualizar Rol si está vinculado
  if (dbInstance) {
    const acc = await dbInstance.collection('accounts').findOne({ gameName: name });
    if (acc && acc.discordId) {
      updateUserRoles(acc.discordId, newRank.split(' ')[0]);
    }
  }
}

async function updateUserRoles(discordId, tier) {
  if (!client) return false;
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return false;
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return false;

    const roleEnvMap = {
      IRON: 'ROLE_IRON', BRONZE: 'ROLE_BRONZE', SILVER: 'ROLE_SILVER', GOLD: 'ROLE_GOLD',
      PLATINUM: 'ROLE_PLATINUM', EMERALD: 'ROLE_EMERALD', DIAMOND: 'ROLE_DIAMOND',
      MASTER: 'ROLE_MASTER', GRANDMASTER: 'ROLE_GRANDMASTER', CHALLENGER: 'ROLE_CHALLENGER'
    };

    const targetRoleId = process.env[roleEnvMap[tier.toUpperCase()]];
    if (!targetRoleId) return false;

    const allRankRoleIds = Object.values(roleEnvMap).map(v => process.env[v]).filter(id => id);
    
    // Solo actuar si el usuario no tiene YA el rol correcto
    if (member.roles.cache.has(targetRoleId)) return true;

    // Quitar otros roles de rango
    const rolesToRemove = allRankRoleIds.filter(id => id !== targetRoleId && member.roles.cache.has(id));
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
    }
    
    // Añadir nuevo rol
    await member.roles.add(targetRoleId);
    return true;
  } catch (e) {
    console.error(`[Role Error] No se pudo actualizar rol para ${discordId}:`, e.message);
    return false;
  }
}

// Alerta de Partida en Vivo
async function notifyLiveGame(acc, gameData) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const version = gameData.version || '15.8.1';
  const iconId = gameData.profileIconId || acc.profileIconId || 0;
  const playerIcon = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
  const champIcon = gameData.championId ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${gameData.championId}.png` : null;

  const tier = acc.soloQ?.tier || 'UNRANKED';
  const rank = acc.soloQ?.rank || '';
  const lp = acc.soloQ?.leaguePoints || 0;
  const rankDisplay = tier === 'UNRANKED' ? 'Unranked' : `${tier} ${rank} (${lp} LP)`;

  const title = `Live Game for ${acc.gameName}#${acc.tagLine}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .addFields(
      { name: 'Campeón', value: gameData.championName || 'Desconocido', inline: true },
      { name: 'Rango', value: rankDisplay, inline: true }
    )
    .setThumbnail(champIcon)
    .setColor(0x576bce)
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`bet_gana_${acc.puuid}`)
        .setLabel('Gana 💰')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bet_pierde_${acc.puuid}`)
        .setLabel('Pierde 💀')
        .setStyle(ButtonStyle.Danger)
    );

  return await channel.send({ embeds: [embed], components: [row] });
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

const QUEUE_NAMES = {
  420: 'SoloQ',
  440: 'Flex'
};

const TIER_SHORT = {
  IRON: 'Hierro', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro',
  PLATINUM: 'Plat', EMERALD: 'Esme', DIAMOND: 'Diam', MASTER: 'Maestro',
  GRANDMASTER: 'GM', CHALLENGER: 'Chall'
};

// Notificación de resultados de apuestas
async function notifyBetResults(targetName, result, winners, profileIconId, championId, lpData, kda, version, totalBets = 0, queueId = 420, highlights = null) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const v = version || '15.8.1';
  const playerIcon = `https://ddragon.leagueoflegends.com/cdn/${v}/img/profileicon/${profileIconId || 0}.png`;
  const champIcon = championId ? `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${championId}.png` : null;

  const queueName = QUEUE_NAMES[queueId] || 'Partida';
  const resultText = result === 'gana' ? 'Victory' : 'Defeat';
  const title = `${queueName} ${resultText} for ${targetName}`;

  let rankStr = 'N/A';
  let lpChangeStr = '+0 LP';

  if (lpData && typeof lpData === 'object') {
    const shortTier = TIER_SHORT[lpData.tier] || lpData.tier || '';
    const div = lpData.rank || '';
    rankStr = `${shortTier} ${div} - ${lpData.lp}LP`;
    const prefix = lpData.diff >= 0 ? '+' : '';
    lpChangeStr = `${prefix}${lpData.diff} LP`;
  } else if (typeof lpData === 'string') {
    rankStr = lpData;
  }

  const embedBet = new EmbedBuilder()
    .setTitle(title)
    .setThumbnail(champIcon)
    .addFields(
      { name: 'K/D/A', value: kda || '0/0/0', inline: true },
      { name: 'Rank', value: rankStr, inline: true },
      { name: 'LP Win', value: lpChangeStr, inline: true }
    )
    .setColor(result === 'gana' ? 0x576bce : 0xd93f3f)
    .setTimestamp();



  // Lógica de ganadores: solo si hubo apuestas
  if (totalBets > 0) {
    const description = winners.length > 0 
      ? `**Ganadores:**\n${winners.map(w => {
          const userStr = w.anonymous ? '👤 *Anónimo*' : `<@${w.discordId}>`;
          const prize = Math.floor(w.amount * (w.multiplier || 2));
          return `${userStr} (Elección: **${w.choice.toUpperCase()}**) - Ganó **${prize} 💰**`;
        }).join('\n')}`
      : 'No hubo ganadores esta vez.';
    embedBet.setDescription(description);
  }

  channel.send({ embeds: [embedBet] });
}

// Notificación de Remake
async function notifyRemake(targetName) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const title = `Remake for ${targetName}`;

  const embedRemake = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`La partida fue un remake (menos de 3:30 min).\nTodas las apuestas han sido **reembolsadas** automáticamente. 💰`)
    .setColor(0xf39c12)
    .setTimestamp();

  channel.send({ embeds: [embedRemake] });
}

// Notificación de Reto Completado
async function notifyChallengeComplete(targetName, challenges, coins) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const title = `Challenge Complete for ${targetName}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .addFields(
      { name: 'Retos Superados', value: challenges.map(c => `🔹 ${c}`).join('\n'), inline: false },
      { name: 'Recompensa', value: `${coins} Naafiri Coins 💰`, inline: true }
    )
    .setColor(0xf4c874)
    .setThumbnail('https://static.wikia.nocookie.net/leagueoflegends/images/1/1b/Season_2023_-_Master_1.png')
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

// Función para notificar al admin vía DM
async function notifyAdmin(message) {
  if (!client || !process.env.ADMIN_DISCORD_ID) return;
  try {
    const admin = await client.users.fetch(process.env.ADMIN_DISCORD_ID);
    if (admin) {
      await admin.send(message);
    }
  } catch (e) {
    console.error('[Admin Notify Error]', e);
  }
}

module.exports = { 
  initBot, 
  notifyRankChange, 
  notifyLiveGame, 
  sendDailySummary, 
  notifyBetResults, 
  notifyRemake, 
  notifyChallengeComplete, 
  notifyAdmin,
  GACHA_ITEMS 
};
