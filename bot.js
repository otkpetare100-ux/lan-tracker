const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

let client = null;
let targetChannelId = process.env.DISCORD_CHANNEL_ID;

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
  if (!process.env.DISCORD_TOKEN) {
    console.warn('Ã¢Å¡Â Ã¯Â¸Â No se detectó DISCORD_TOKEN. El bot no iniciará.');
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

    if (command === 'help' || command === 'ayuda') {
      const now = Date.now();
      const lastUsed = helpCooldowns.get(msg.author.id) || 0;
      const cooldownAmount = 5 * 60 * 1000;

      if (now - lastUsed < cooldownAmount) {
        const timeLeft = Math.ceil((cooldownAmount - (now - lastUsed)) / 60000);
        return msg.reply(`⌛ Por favor, espera **${timeLeft} minuto(s)** para volver a usar el comando de ayuda.`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🐾 Guía de Comandos - LAN Tracker')
        .setDescription('¡Bienvenido a la perrera! Aquí tienes todo lo que puedes hacer:')
        .addFields(
          { name: '👤 Perfil y Rango', value: '`!perfil [Nombre#TAG]` - Mira tu rango y estadísticas.\n`!vincular Nombre#TAG` - Vincula tu cuenta de Discord.\n`!ladder` - Top 10 mejores jugadores.' },
          { name: '💰 Economía', value: '`!monedas` - Mira tu saldo actual.\n`!diario` - Reclama tus 100 coins diarias.\n`!top_ricos` - Top 10 usuarios con más monedas.' },
          { name: '🎮 Diversión y Apuestas', value: '`!apostar [cant] [gana/pierde] [Nombre#TAG]` - Apuesta en una partida en vivo.\n`!gacha` - Gasta 10 coins para conseguir un campeón.\n`!mochila` - Mira tu colección de campeones.\n`!shame` - El muro de la vergüenza (peores Winrates).' }
        )
        .setColor(0x576bce)
        .setFooter({ text: 'Naafiri Bot · LAN Tracker' });
      
      helpCooldowns.set(msg.author.id, now);
      return msg.reply({ embeds: [embed] });
    }

    if (command === 'perfil') {
      let slug = args.join(' '); // Soporta nombres con espacios
      let acc = null;

      if (!slug) {
        // Intentar buscar vinculación automática
        acc = await db.collection('accounts').findOne({ discordId: msg.author.id });
        if (!acc) return msg.reply('Ã¢ÂÅ’ No estás vinculado. Usa `!perfil Nombre#TAG` o vincúlate con `!vincular`.');
      } else {
        acc = await findAccountBySlug(slug);
      }

      if (!acc) return msg.reply('Jugador no encontrado en el dashboard.');

      const embed = new EmbedBuilder()
        .setTitle(`${acc.gameName}#${acc.tagLine}`)
        .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png`)
        .setColor(RANK_COLORS[acc.soloQ?.tier] || 0xffffff)
        .addFields(
          { name: 'Rango SoloQ', value: acc.soloQ ? `${acc.soloQ.tier} ${acc.soloQ.rank} (${acc.soloQ.leaguePoints} LP)` : 'Unranked', inline: true },
          { name: 'Winrate', value: acc.soloQ ? `${Math.round((acc.soloQ.wins / (acc.soloQ.wins + acc.soloQ.losses)) * 100)}%` : 'N/A', inline: true },
          { name: 'Racha', value: acc.streak > 0 ? `🔥 ${acc.streak} Wins` : acc.streak < 0 ? `Ã¢Ââ€žÃ¯Â¸Â ${Math.abs(acc.streak)} Loss` : '—', inline: true }
        )
        .setFooter({ text: 'LAN Tracker Bot' });

      msg.reply({ embeds: [embed] });
    }

    if (command === 'ladder') {
      const accounts = await db.collection('accounts').find({}).toArray();
      const sorted = accounts.sort((a,b) => getRankScore(b) - getRankScore(a)).slice(0, 10);
      
      const list = sorted.map((a, i) => `${i+1}. **${a.gameName}** - ${a.soloQ?.tier || 'Unranked'} ${a.soloQ?.rank || ''}`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle('Ã°Å¸Ââ€  Top 10 de La Perrera')
        .setDescription(list || 'No hay jugadores registrados.')
        .setColor(0xf4c874);

      msg.reply({ embeds: [embed] });
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

    if (command === 'vincular') {
      const slug = args.join(' '); // Soporta nombres con espacios
      if (!slug) return msg.reply('Uso: `!vincular Nombre#TAG`');
      const acc = await findAccountBySlug(slug);
      if (!acc) return msg.reply('âŒ No encontré esa cuenta en el dashboard.');

      const res = await db.collection('accounts').updateOne(
        { puuid: acc.puuid },
        { $set: { discordId: msg.author.id } }
      );

      if (res.modifiedCount > 0) {
        msg.reply(`✅ ¡Cuenta vinculada! Ahora eres oficialmente **${acc.gameName}#${acc.tagLine}**.`);
      } else {
        msg.reply('Ã¢ÂÅ’ No encontré esa cuenta en el dashboard.');
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
      
      if (user && user.lastDaily) {
        const diff = now - new Date(user.lastDaily);
        const waitTime = 24 * 60 * 60 * 1000;
        if (diff < waitTime) {
          const remaining = waitTime - diff;
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          return msg.reply(`Ã¢ÂÂ³ Ya reclamaste tus monedas hoy. Vuelve en **${hours}h ${minutes}m**.`);
        }
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
      const isAnonymous = args.includes('anonimo');
      const filteredArgs = args.filter(arg => arg.toLowerCase() !== 'anonimo');
      
      const amount = parseInt(filteredArgs[0]);
      const choice = filteredArgs[1]?.toLowerCase();
      const targetSlug = filteredArgs.slice(2).join(' ');

      if (isNaN(amount) || amount <= 0 || !['gana', 'pierde'].includes(choice) || !targetSlug) {
        return msg.reply('Uso: `!apostar [cantidad] [gana/pierde] Nombre#TAG [anonimo]`');
      }

      const targetAcc = await findAccountBySlug(targetSlug);
      if (!targetAcc) return msg.reply('Ã¢ÂÅ’ Ese jugador no está registrado en el dashboard.');

      // Calcular multiplicador dinámico basado en Winrate
      let multiplier = 2.0;
      if (targetAcc.soloQ && (targetAcc.soloQ.wins + targetAcc.soloQ.losses) > 0) {
        const totalGames = targetAcc.soloQ.wins + targetAcc.soloQ.losses;
        const wr = (targetAcc.soloQ.wins / totalGames) * 100;
        if (wr > 60) multiplier = 1.5; // Favorito
        else if (wr < 45) multiplier = 3.0; // Underdog
      }

      // Validación de tiempo de partida (Límite 5 min)
      try {
        const liveUrl = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${targetAcc.puuid.trim()}`;
        const liveRes = await fetch(liveUrl, { headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() } });
        if (liveRes.ok) {
          const gameData = await liveRes.json();
          // gameLength en spectator v5 es el tiempo transcurrido en segundos
          if (gameData.gameLength > 300) {
            return msg.reply(`Ã¢ÂÅ’ **Demasiado tarde.** La partida de **${targetAcc.gameName}** ya lleva ${Math.floor(gameData.gameLength / 60)} minutos. Solo se permite apostar durante los primeros 5 minutos.`);
          }
        }
      } catch (e) {
        console.error('Error validando tiempo de partida:', e);
      }

      const user = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!user || user.coins < amount) return msg.reply('Ã¢ÂÅ’ No tienes suficientes Naafiri Coins.');

      // Guardar apuesta
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
      msg.reply(`✅ Apuesta registrada ${isAnonymous ? '(Anónima)' : ''}: **${amount} coins** (Multiplicador: **${multiplier}x**). ¡La elección se revelará al final! Ã°Å¸Â¤Â`);
    }

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
      { id: 'Golden_Naafiri', name: 'Naafiri Dorada (Exclusiva)', rarity: 'Legendario', weight: 2, img: 'Naafiri_0' }
    ];

    if (command === 'gacha' || command === 'tiro') {
      const COST = 10;
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });

      if (!userEco || userEco.coins < COST) {
        return msg.reply(`Ã¢ÂÅ’ No tienes suficientes coins. El tiro de Gachapon cuesta **${COST} 💰**.`);
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

      msg.reply({ embeds: [embedGacha] });

      if (selected.rarity === 'Legendario') {
        msg.channel.send(`🎊 ¡ATENCIÓN! **${msg.author.username}** acaba de conseguir un objeto **LEGENDARIO**: **${selected.name}**! 🎊`);
      }
    }

    if (command === 'mochila' || command === 'inv') {
      const userEco = await db.collection('economy').findOne({ discordId: msg.author.id });
      if (!userEco || !userEco.inventory || userEco.inventory.length === 0) {
        return msg.reply('🎒 Tu mochila está vacía. ¡Usa `!gacha` para empezar tu colección!');
      }

      // Agrupar items duplicados y contar cantidad
      const grouped = {};
      for (const item of userEco.inventory) {
        if (!grouped[item.id]) grouped[item.id] = { ...item, count: 0 };
        grouped[item.id].count++;
      }

      const items = Object.values(grouped).map(item => {
        const icon = item.rarity === 'Legendario' ? 'Ã¢Â­Â' : item.rarity === 'Épico' ? '💜' : item.rarity === 'Raro' ? '🔹' : '⚪';
        const qty = item.count > 1 ? ` **x${item.count}**` : '';
        return `${icon} **${item.name}**${qty} (${item.rarity})`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🎒 Mochila de ${msg.author.username}`)
        .setDescription(items)
        .setColor(0x2ecc71);

      msg.reply({ embeds: [embed] });
    }

    // =============================================
    // --- COMANDOS ADMIN (solo ADMIN_DISCORD_ID) ---
    // =============================================
    if (command.startsWith('admin_')) {
      if (!isAdmin(msg.author.id)) {
        return msg.reply('🚫 No tienes permisos de administrador.');
      }

      // !admin_dar @usuario cantidad
      if (command === 'admin_dar') {
        const target = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        if (!target || isNaN(amount) || amount <= 0)
          return msg.reply('Uso: `!admin_dar @usuario cantidad`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $inc: { coins: amount }, $set: { discordTag: target.tag } },
          { upsert: true }
        );
        return msg.reply(`✅ **+${amount} coins** dados a ${target.username}.`);
      }

      // !admin_quitar @usuario cantidad
      if (command === 'admin_quitar') {
        const target = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        if (!target || isNaN(amount) || amount <= 0)
          return msg.reply('Uso: `!admin_quitar @usuario cantidad`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $inc: { coins: -amount } }
        );
        return msg.reply(`✅ **-${amount} coins** quitados a ${target.username}.`);
      }

      // !admin_setcoins @usuario cantidad
      if (command === 'admin_setcoins') {
        const target = msg.mentions.users.first();
        const amount = parseInt(args.find(a => !isNaN(a) && a !== ''));
        if (!target || isNaN(amount) || amount < 0)
          return msg.reply('Uso: `!admin_setcoins @usuario cantidad`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $set: { coins: amount, discordTag: target.tag } },
          { upsert: true }
        );
        return msg.reply(`✅ Coins de ${target.username} fijados a **${amount}**.`);
      }

      // !admin_resetdiario @usuario
      if (command === 'admin_resetdiario') {
        const target = msg.mentions.users.first();
        if (!target) return msg.reply('Uso: `!admin_resetdiario @usuario`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $unset: { lastDaily: '' } }
        );
        return msg.reply(`✅ Cooldown de diario reseteado para **${target.username}**.`);
      }

      if (command === 'admin_daritem') {
        const target = msg.mentions.users.first();
        const itemId = args[1];
        const item = GACHA_ITEMS.find(i => i.id === itemId);
        if (!target || !item) return msg.reply('Uso: `!admin_daritem @usuario <itemId>`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $addToSet: { inventory: { id: item.id, name: item.name, rarity: item.rarity, date: new Date() } } },
          { upsert: true }
        );
        return msg.reply(`✅ Item **${item.name}** (${item.rarity}) dado a **${target.username}**.`);
      }

      if (command === 'admin_scan') {
        const accounts = await db.collection('accounts').find({}).toArray();
        const statusMsg = await msg.reply(`🔍 Escaneando partidas en vivo para **${accounts.length}** cuentas...`);
        
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
        return msg.reply(`🔑 **Debug Key:**\n- Máscara: \`${masked}\`\n- Longitud: \`${key.length}\`\n- Variable ENV: \`${process.env.RIOT_API_KEY ? 'Detectada ✅' : 'No detectada ❌'}\``);
      }

      if (command === 'admin_testnotif') {
        const testAcc = { gameName: 'Jugador de Prueba' };
        const testData = { championName: 'Naafiri' };
        await notifyLiveGame(testAcc, testData);
        return msg.reply('✅ Notificación de prueba enviada al canal de anuncios.');
      }

      if (command === 'admin_testsummary') {
        await sendDailySummary();
        return msg.reply('✅ Resumen diario de prueba enviado.');
      }

      if (command === 'admin_testbet') {
        const testWinners = [
          { discordId: msg.author.id, amount: 50, multiplier: 2.0, choice: 'gana', anonymous: false }
        ];
        await notifyBetResults('Jugador de Prueba', 'gana', testWinners);
        return msg.reply('✅ Notificación de apuesta de prueba enviada.');
      }

      if (command === 'admin_check') {
        const slug = args.join(' ');
        if (!slug) return msg.reply('Uso: `!admin_check Nombre#TAG`');
        
        const acc = await findAccountBySlug(slug);
        if (!acc) return msg.reply('❌ Jugador no encontrado en el dashboard.');

        const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${acc.puuid.trim()}`;
        const res = await fetch(url, {
          headers: { "X-Riot-Token": process.env.RIOT_API_KEY.trim() }
        });

        if (res.ok) {
          const game = await res.json();
          // Obtener nombre del campeón
          const champRes = await fetch('https://ddragon.leagueoflegends.com/cdn/15.8.1/data/es_MX/champion.json');
          const champData = await champRes.json();
          const me = game.participants.find(p => p.puuid === acc.puuid);
          const champName = me ? (Object.values(champData.data).find(c => c.key == me.championId)?.name || 'Desconocido') : 'Desconocido';

          const champKey = Object.keys(champData.data).find(key => champData.data[key].key == me.championId); const cName = champKey ? champData.data[champKey].name : 'Desconocido'; await notifyLiveGame(acc, { championName: cName, championId: champKey });
          return msg.reply(`✅ **${acc.gameName}** está en partida. Notificación enviada.`);
        } else {
          return msg.reply(`💤 **${acc.gameName}** no parece estar en partida ahora mismo.`);
        }
      }

      // !admin_clearinv @usuario
      if (command === 'admin_clearinv') {
        const target = msg.mentions.users.first();
        if (!target) return msg.reply('Uso: `!admin_clearinv @usuario`');
        await db.collection('economy').updateOne(
          { discordId: target.id },
          { $set: { inventory: [] } }
        );
        return msg.reply(`✅ Inventario de **${target.username}** vaciado.`);
      }

      // !admin_anuncio [mensaje]
      if (command === 'admin_anuncio') {
        const message = args.join(' ');
        if (!message) return msg.reply('Uso: `!admin_anuncio [mensaje]`');
        const embed = new EmbedBuilder()
          .setTitle('ðŸ“¢ ANUNCIO OFICIAL')
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
            { name: 'ðŸ‘¥ Usuarios registrados', value: `${totalUsers}`, inline: true },
            { name: '💰 Coins en circulación', value: `${allCoins[0]?.total || 0}`, inline: true },
            { name: '🎰 Items en inventarios', value: `${totalItems[0]?.total || 0}`, inline: true },
            { name: 'Ã°Å¸Ââ€  Usuario más rico', value: richest[0] ? `${richest[0].discordTag} — ${richest[0].coins} coins` : 'N/A', inline: false }
          )
          .setColor(0x576bce);
        return msg.reply({ embeds: [embed] });
      }

      // !admin_cancelarApuestas Nombre#TAG
      if (command === 'admin_cancelarapuestas') {
        const slug = args.join(' ');
        if (!slug) return msg.reply('Uso: `!admin_cancelarApuestas Nombre#TAG`');
        const [name, tag] = slug.split('#');
        const acc = await db.collection('accounts').findOne({
          gameName: { $regex: new RegExp(`^${name}$`, 'i') },
          tagLine:  { $regex: new RegExp(`^${tag}$`, 'i') }
        });
        if (!acc) return msg.reply('Ã¢ÂÅ’ Jugador no encontrado en el dashboard.');
        const openBets = await db.collection('bets').find({ targetPuuid: acc.puuid, status: 'open' }).toArray();
        if (!openBets.length) return msg.reply('No hay apuestas abiertas para ese jugador.');
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
        return msg.reply(`✅ **${openBets.length}** apuesta(s) canceladas y reembolsadas para **${acc.gameName}#${acc.tagLine}**.`);
      }

      // !admin_resetAll CONFIRMAR
      if (command === 'admin_resetall') {
        if (args[0] !== 'CONFIRMAR') {
          return msg.reply('Ã¢Å¡Â Ã¯Â¸Â Esto pondrá a **0 coins** a TODOS los usuarios.\nPara confirmar escribe: `!admin_resetAll CONFIRMAR`');
        }
        const result = await db.collection('economy').updateMany({}, { $set: { coins: 0 } });
        return msg.reply(`✅ Reset global completado. **${result.modifiedCount}** usuario(s) puestos a 0 coins.`);
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

  const playerIcon = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png`;
  const champIcon = gameData.championId ? `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${gameData.championId}.png` : null;

  const embed = new EmbedBuilder()
    .setAuthor({ name: acc.gameName, iconURL: playerIcon })
    .setTitle('PARTIDA EN VIVO')
    .setDescription(`¡Acaba de entrar en una partida!\n**Campeón:** ${gameData.championName || 'Desconocido'}`)
    .setThumbnail(champIcon)
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
    .setTitle('Ã¢Ëœâ‚¬Ã¯Â¸Â ¡Buenos días, Perrera!')
    .setDescription('¿Quién se va a sacar la primera victoria hoy? Ã¢Å¡â€Ã¯Â¸Â\nUsen `!diario` para sus monedas.')
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

// Notificación de resultados de apuestas
async function notifyBetResults(targetName, result, winners) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const description = winners.length > 0 
    ? `**Ganadores:**\n${winners.map(w => {
        const userStr = w.anonymous ? '👤 *Anónimo*' : `<@${w.discordId}>`;
        const prize = Math.floor(w.amount * (w.multiplier || 2));
        return `${userStr} (Elección: **${w.choice.toUpperCase()}**) - Ganó **${prize} 💰**`;
      }).join('\n')}`
    : 'No hubo ganadores esta vez.';

  const emoji = result === 'gana' ? '\uD83C\uDFC6' : '💀';
  const embedBet = new EmbedBuilder()
    .setTitle(`${emoji} Resultados de Apuestas: ${targetName}`)
    .setDescription(`El jugador ha **${result.toUpperCase()}DO** la partida.\n\n${description}`)
    .setColor(winners.length > 0 ? 0xf1c40f : 0x95a5a6)
    .setTimestamp();

  channel.send({ embeds: [embedBet] });
}

// Notificación de Remake
async function notifyRemake(targetName) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const embedRemake = new EmbedBuilder()
    .setTitle('🔄 Remake Detectado')
    .setDescription(`La partida de **${targetName}** fue un remake (menos de 3:30 min).\nTodas las apuestas han sido **reembolsadas** automáticamente. 💰`)
    .setColor(0xf39c12)
    .setTimestamp();

  channel.send({ embeds: [embedRemake] });
}

// Notificación de Reto Completado
async function notifyChallengeComplete(targetName, challenges, coins) {
  if (!client || !targetChannelId) return;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('✨ ¡RETO COMPLETADO! ✨')
    .setDescription(`¡Increíble! **${targetName}** ha superado los siguientes retos en su última partida:\n\n${challenges.map(c => `Ã°Å¸â€Â¹ ${c}`).join('\n')}\n\nRecompensa total: **${coins} Naafiri Coins** 💰`)
    .setColor(0xf4c874)
    .setThumbnail('https://static.wikia.nocookie.net/leagueoflegends/images/1/1b/Season_2023_-_Master_1.png') // Icono de Master para darle prestigio
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

module.exports = { initBot, notifyRankChange, notifyLiveGame, sendDailySummary, notifyBetResults, notifyRemake, notifyChallengeComplete };

