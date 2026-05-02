const fs = require('fs');
const path = 'c:/Users/Nanami/Desktop/s/bot.js';
let content = fs.readFileSync(path, 'utf8');

// Definir el bloque de validación y multiplicador correctamente
const betLogic = `
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
          return msg.reply(\`❌ **Demasiado tarde.** El aviso de partida de **\${targetAcc.gameName}** salió hace \${diffMins} minutos. Solo se permite apostar durante los primeros 5 minutos del aviso.\`);
        }
      }

      const user = await db.collection('economy').findOne({ discordId: msg.author.id });`;

// Reemplazar el hueco dejado por el editor
content = content.replace(/if \(!targetAcc\) return msg\.reply\('Ã¢Â Å’ Ese jugador no está registrado en el dashboard\.'\);\s*const user = await db\.collection\('economy'\)\.findOne\({ discordId: msg\.author\.id }\);/, `if (!targetAcc) return msg.reply('❌ Ese jugador no está registrado en el dashboard.');\n${betLogic}`);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ bot.js corregido: Tiempo de aviso y multiplicadores restaurados.');
