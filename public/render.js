let DDRAGON_VERSION = '15.8.1';
const FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

// Actualizar versión automáticamente al cargar
fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  .then(res => res.json())
  .then(versions => { 
    if (versions && versions.length > 0) DDRAGON_VERSION = versions[0]; 
  });

function getProfileIconUrl(id) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;
}

const RANK_COLORS = {
  IRON: '#6B5A4E', BRONZE: '#CD7F32', SILVER: '#A8A9AD', GOLD: '#C89B3C',
  PLATINUM: '#00B4B0', EMERALD: '#00C65E', DIAMOND: '#578ACA',
  MASTER: '#9D4DC7', GRANDMASTER: '#CF4FC9', CHALLENGER: '#F4C874', UNRANKED: '#3D5068',
};

const RANK_ICONS = {
  IRON:        '/pic/ranks/iron.png',
  BRONZE:      '/pic/ranks/bronze.png',
  SILVER:      '/pic/ranks/silver.png',
  GOLD:        '/pic/ranks/gold.png',
  PLATINUM:    '/pic/ranks/platinum.png',
  EMERALD:     '/pic/ranks/emerald.png',
  DIAMOND:     '/pic/ranks/diamond.png',
  MASTER:      '/pic/ranks/master.png',
  GRANDMASTER: '/pic/ranks/grandmaster.png',
  CHALLENGER:  '/pic/ranks/challenger.png',
  UNRANKED:    '/pic/ranks/unranked.png',
};

const CHAMP_NAME_FIX = {
  // Entradas unificadas de ambas listas
  'AurelionSol': 'AurelionSol', 'Belveth': 'Belveth', 'BelVeth': 'Belveth',
  'Chogath': 'Chogath', 'ChoGath': 'Chogath',
  'DrMundo': 'DrMundo', 'JarvanIV': 'JarvanIV',
  'Kaisa': 'Kaisa', 'KaiSa': 'Kaisa',
  'Khazix': 'Khazix', 'KhaZix': 'Khazix',
  'KogMaw': 'KogMaw', 'KSante': 'KSante',
  'Leblanc': 'Leblanc', 'LeBlanc': 'Leblanc',
  'LeeSin': 'LeeSin', 'MasterYi': 'MasterYi',
  'MissFortune': 'MissFortune',
  'MonkeyKing': 'MonkeyKing', 'Wukong': 'MonkeyKing',
  'Nunu': 'Nunu', 'NunuWillump': 'Nunu', 'NunuyWillump': 'Nunu',
  'RekSai': 'RekSai', 'TahmKench': 'TahmKench', 'TwistedFate': 'TwistedFate',
  'Velkoz': 'Velkoz', 'VelKoz': 'Velkoz',
  'XinZhao': 'XinZhao',
  'Fiddlesticks': 'Fiddlesticks', 'FiddleSticks': 'Fiddlesticks', 'fiddlesticks': 'Fiddlesticks',
  'Renata': 'Renata', 'RenataGlasc': 'Renata',
  'Mel': 'Mel',
};

function getRankInfo(acc) {
  const soloQ = acc.soloQ;
  if (!soloQ) return { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0 };
  return { tier: soloQ.tier, division: soloQ.rank, lp: soloQ.leaguePoints, wins: soloQ.wins, losses: soloQ.losses };
}

function computeWinrate(wins, losses) {
  const total = wins + losses;
  return total === 0 ? null : Math.round((wins / total) * 100);
}

function winrateClass(wr) {
  if (wr === null) return 'empty';
  if (wr >= 55) return 'good';
  if (wr > 50)  return 'good';
  if (wr === 50) return 'neutral';
  if (wr >= 48) return 'ok';
  return 'bad';
}

function wrColor(wr) {
  if (wr === null) return '#888';
  // Normalizar: 40% → 0 (rojo pleno), 60% → 1 (verde pleno)
  // Fuera de ese rango se clampea al extremo
  const t = Math.max(0, Math.min(1, (wr - 40) / 20));
  // Hue: 0=rojo, 120=verde
  const hue = Math.round(t * 120);
  // Saturación: máxima en extremos (t=0 ó t=1), cero en el centro (t=0.5 → blanco)
  const distFromMid = Math.abs(t - 0.5) * 2; // 0 en centro, 1 en extremos
  const sat = Math.round(distFromMid * 90);
  // Luminosidad: más clara en el centro para que el blanco se vea bien
  const lit = sat < 5 ? 92 : 52;
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

function getStreakInfo(streak) {
  if (streak >= 3) return { class: 'card-streak-win', glow: 'avatar-glow-fire' };
  if (streak <= -3) return { class: 'card-streak-loss', glow: 'avatar-glow-ice' };
  return { class: '', glow: '' };
}

function getSpecialistInfo(matches) {
  if (!matches || matches.length < 10) return { name: null, class: '' };
  const counts = {};
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i].champion;
    counts[name] = (counts[name] || 0) + 1;
  }
  for (const name in counts) {
    if (counts[name] >= 10) return { name: name, class: 'specialist-card' };
  }
  return { name: null, class: '' };
}

function titleCase(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// (mapeo unificado arriba — se eliminó la redeclaración)

function getChampImageName(name) {
  if (!name) return 'Unknown.png';
  var base = name.replace(/\.png$/i, '');
  var clean = base.replace(/[^a-zA-Z0-9]/g, '');
  return (CHAMP_NAME_FIX[clean] || CHAMP_NAME_FIX[base] || clean) + '.png';
}

// timeAgo unificada: acepta tanto un timestamp numérico como un objeto Date/string

function buildStreakHTML(streak) {
  if (!streak || streak === 0) return '';
  const isWin = streak > 0;
  const cls   = isWin ? 'streak-win' : 'streak-loss';
  const label = Math.abs(streak) + (isWin ? 'V seguidas' : 'D seguidas');
  return '<span class="streak-badge ' + cls + '">' + label + '</span>';
}

const QUEUE_TYPES = {
  420: 'Clasificatoria Solo',
  440: 'Clasificatoria Flexible',
  400: 'Normal (Recluta)',
  430: 'Normal (Oculta)',
  450: 'ARAM',
  1700: 'Arena',
  1900: 'U.R.F.',
  700: 'Clash'
};

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `Hace ${days} d${days > 1 ? 'ías' : 'ía'}`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `Hace ${hours} h`;
  const mins = Math.floor(diff / (1000 * 60));
  return `Hace ${mins} m`;
}

function buildMatchHistoryHTML(matches, playerPuuid) {
  if (!matches || matches.length === 0) return '<div class="match-empty">Sin partidas registradas</div>';
  
  return '<div class="match-history-v2">' + matches.map(function(m) {
    const isWin = m.win;
    const cls = isWin ? 'mv2-win' : 'mv2-loss';
    const kda = m.kills + '<span class="kda-slash">/</span>' + m.deaths + '<span class="kda-slash">/</span>' + m.assists;
    const dur = Math.floor(m.gameDuration / 60) + 'min ' + (m.gameDuration % 60) + 's';
    const time = timeAgo(m.timestamp);
    const queue = QUEUE_TYPES[m.queueId] || 'Partida';
    const champImg = 'https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/champion/' + getChampImageName(m.champion);
    
    // Items - Asegurar 8 slots
    let itmArr = m.items || [];
    if (itmArr.length === 0) itmArr = [0,0,0,0,0,0,0,0];
    const itemsHTML = itmArr.slice(0, 8).map(id => {
      if (!id || id === 0) return '<div class="mv2-item empty"></div>';
      return '<img class="mv2-item" src="https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/item/' + id + '.png" onerror="this.style.visibility=\'hidden\'" />';
    }).join('');
    // Rellenar si faltan slots hasta 8
    const extraItemsHTML = itmArr.length < 8 ? Array(8 - itmArr.length).fill('<div class="mv2-item empty"></div>').join('') : '';

    // Participants
    const parts = m.participants || [];
    let participantsHTML = '';
    if (parts.length >= 10) {
      const team1 = parts.slice(0, 5);
      const team2 = parts.slice(5, 10);
      const renderPart = (p) => {
        const isMe = p.puuid === playerPuuid;
        const pImg = 'https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/champion/' + getChampImageName(p.champion);
        return '<div class="mv2-p-icon ' + (isMe ? 'me' : '') + '"><img src="' + pImg + '" title="' + escapeHTML(p.champion) + '" /></div>';
      };
      participantsHTML = '<div class="mv2-participants"><div class="mv2-p-col">' + team1.map(renderPart).join('') + '</div><div class="mv2-p-col">' + team2.map(renderPart).join('') + '</div></div>';
    }

    const shortQueue = queue.replace('Clasificatoria ', '').replace('Normal (Recluta)', 'Draft').replace('Normal (Oculta)', 'Blind');

    const resultLabel = isWin ? 'Victoria' : 'Derrota';

    return '<div class="match-v2-row ' + cls + '" onclick="event.stopPropagation(); openMatchModal(\'' + m.matchId + '\')">' +
      '<div class="m-row-meta">' +
        '<div class="m-queue">' + shortQueue + '</div>' +
        '<div class="m-time">' + time + '</div>' +
        '<div class="m-divider"></div>' +
        '<div class="m-result">' + resultLabel + '</div>' +
        '<div class="m-duration">' + dur + '</div>' +
      '</div>' +
      '<div class="m-row-champ">' +
        '<img class="m-champ-icon" src="' + champImg + '" />' +
      '</div>' +
      '<div class="m-row-kda">' +
        '<div class="m-kda">' + kda + '</div>' +
        '<div class="m-cs">' + (m.cs || 0) + ' CS</div>' +
      '</div>' +
      '<div class="m-row-items">' +
        itemsHTML + extraItemsHTML +
      '</div>' +
      '<div class="m-row-participants">' +
        participantsHTML +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}

function buildTopChampsHTML(topChampions, puuid) {
  if (!topChampions || topChampions.length === 0) return '';
  return topChampions.map(function(c) {
    if (!c.name) return '';
    var img = 'https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/champion/' + getChampImageName(c.name);
    return '<div class="top-champ" title="Ver estadísticas de ' + escapeHTML(c.name) + '" onclick="openChampModal(\'' + puuid + '\', \'' + escapeHTML(c.name) + '\')">' +
      '<img src="' + img + '" alt="' + escapeHTML(c.name) + '" onerror="this.style.display=\'none\'" />' +
    '</div>';
  }).join('');
}

function buildMatchDots(matches) {
  if (!matches || matches.length === 0) return '';
  return '<div class="match-dots" style="display:flex; gap:4px; margin-top:5px;">' +
    matches.slice(0, 5).map(function(m) {
      const cls = m.win ? 'dot-win' : 'dot-loss';
      const mId = m.matchId || m.gameId;
      return `<span class="dot ${cls}" style="cursor:pointer;" title="${m.win ? 'Victoria' : 'Derrota'} · ${escapeHTML(m.champion || '')}" onclick="event.stopPropagation(); openMatchModal('${mId}')"></span>`;
    }).join('') +
  '</div>';
}

/* ---- Funcionalidad: Reacciones Visuales ---- */
function buildReactionsHTML(reactions, puuid) {
  const emojis = ['🔥', '💀', '👑', '🤡'];
  const userId = 'local-user'; // Simplificado
  if (!reactions) reactions = {};
  
  return '<div class="card-reactions">' +
    emojis.map(function(e) {
      const users = reactions[e] || [];
      const active = users.includes(userId);
      return '<button class="reaction-btn ' + (active ? 'reaction-btn--active' : '') + '" onclick="toggleReaction(\'' + puuid + '\', \'' + e + '\')">' +
        e + ' <span>' + users.length + '</span>' +
      '</button>';
    }).join('') +
  '</div>';
}

async function toggleReaction(puuid, emoji) {
  const globalAccs = window._accounts_ref || [];
  const acc = globalAccs.find(function(a) { return a.puuid === puuid; });
  if (!acc) return;

  // --- Lógica Optimista: Actualizar UI antes de que responda el servidor ---
  if (!acc.reactions) acc.reactions = {};
  if (!acc.reactions[emoji]) acc.reactions[emoji] = [];
  
  const idx = acc.reactions[emoji].indexOf('local-user');
  const wasReacted = idx > -1;
  
  // Guardamos estado previo por si falla el servidor (Rollback)
  if (wasReacted) acc.reactions[emoji].splice(idx, 1);
  else acc.reactions[emoji].push('local-user');

  // Actualizar DOM inmediatamente
  const updateUI = () => {
    const card = document.getElementById('card-' + puuid);
    if (card) {
      const container = card.querySelector('.card-reactions');
      if (container) container.outerHTML = buildReactionsHTML(acc.reactions, puuid);
    }
  };
  updateUI();

  try {
    const res = await fetch('/accounts/' + puuid + '/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: emoji, userId: 'local-user' })
    });
    
    if (!res.ok) throw new Error('Servidor no respondió');
  } catch(e) {
    // --- Rollback: Si falla la red, volvemos atrás ---
    const currentIdx = acc.reactions[emoji].indexOf('local-user');
    if (currentIdx > -1) acc.reactions[emoji].splice(currentIdx, 1);
    else acc.reactions[emoji].push('local-user');
    updateUI();
    
    if (typeof showError === 'function') showError('Error de conexión al reaccionar');
    console.error('Error in optimistic reaction:', e);
  }
}

function buildCardHTML(acc, position) {
  const r = getRankInfo(acc);
  const wr = computeWinrate(r.wins, r.losses);
  
  const streakClass = acc.streak >= 3 ? 'streak-win' : acc.streak <= -3 ? 'streak-loss' : '';
  const streakText = acc.streak >= 2 ? `🔥 ${acc.streak}` : acc.streak <= -2 ? `❄️ ${Math.abs(acc.streak)}` : '';
  
  const rankIcon = RANK_ICONS[r.tier] || RANK_ICONS.UNRANKED;
  const noDivisionTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];
  const rankName = noDivisionTiers.includes(r.tier) 
    ? titleCase(r.tier) 
    : titleCase(r.tier) + ' ' + (r.division || '');

  const profileUrl = acc.discordId ? `/perfil/${acc.discordId}` : '#';
  
  const rankNum = position + 1;
  const rankClass = rankNum <= 3 ? `rank-${rankNum}` : '';

  return `
    <div class="scoreboard-row" id="card-${acc.puuid}" data-url="${profileUrl}">
      
      <div class="score-rank ${rankClass}">#${rankNum}</div>
      
      <div class="score-player">
        <div class="score-avatar-wrap">
          <img class="score-avatar" src="${getProfileIconUrl(acc.profileIconId)}" onerror="this.src='${FALLBACK_ICON_URL}'" />
          <div class="score-level">${acc.summonerLevel || '?'}</div>
        </div>
        <div class="score-names">
          <div class="score-name-row">
            <span class="score-name">${escapeHTML(acc.gameName)}</span>
            <div class="status-dot ${acc.liveGameStartedAt ? 'ingame' : 'offline'}" title="${acc.liveGameStartedAt ? 'En partida' : 'Offline'}"></div>
          </div>
          <span class="score-tag">#${escapeHTML(acc.tagLine)}</span>
        </div>
      </div>
      
      <div class="score-stats">
        <img class="score-tier-icon" src="${rankIcon}" alt="${r.tier}" />
        <div class="score-tier-text">
          <span class="score-tier-name">${rankName}</span>
          <span class="score-lp-text">${r.lp} LP · <span style="color:${wrColor(wr)};font-weight:700;">${wr !== null ? wr + '%' : '--'}</span> WR</span>
        </div>
      </div>
      
      <div class="score-actions">
        ${streakText ? `<span class="streak-badge ${acc.streak > 0 ? 'win' : 'loss'}">${streakText}</span>` : ''}
        ${buildMatchDots(acc.matches)}
        <div class="score-btn-group" style="margin-left: 10px;">
          <button class="history-btn-mini" onclick="openPlayerModal('${acc.puuid}', event)">⚔ Historial</button>
          <button class="refresh-btn" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--gold-primary); cursor:pointer; padding:5px 8px; border-radius:6px; transition:var(--transition);" title="Actualizar" onclick="event.stopPropagation(); handleRefresh('${acc.puuid}')">↻</button>
          <button class="note-btn" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--gold-primary); cursor:pointer; padding:5px 8px; border-radius:6px; transition:var(--transition);" title="Notas" onclick="event.stopPropagation(); if(typeof openNoteModal==='function') openNoteModal('${acc.puuid}')">📝</button>
          <button class="remove-btn" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:#d93f3f; cursor:pointer; padding:5px 8px; border-radius:6px; transition:var(--transition);" title="Eliminar" onclick="event.stopPropagation(); handleRemoveAccount('${acc.puuid}')">✕</button>
        </div>
      </div>
      
    </div>
  `;
}

function renderAccounts(accounts) {
  window._accounts_ref = accounts;
  const grid = document.getElementById('accounts-grid');
  if (!grid) return;
  if (accounts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Sin cuentas aún</p></div>';
    return;
  }
  grid.innerHTML = accounts.map((acc, idx) => buildCardHTML(acc, idx)).join('');
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  clearTimeout(window._errorTimeout);
  if (msg) {
    window._errorTimeout = setTimeout(function() {
      el.style.display = 'none';
      el.textContent = '';
    }, 5000);
  }
}

function getApiErrorMessage(status) {
  switch (status) {
    case 400: return 'Solicitud inválida. Revisa el formato Nombre#TAG.';
    case 403: return 'API key inválida o expirada. Renuévala en developer.riotgames.com';
    case 404: return 'Cuenta no encontrada en LAN. Verifica el nombre y tag.';
    case 429: return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    case 503: return 'El servidor de Riot está caído. Intenta más tarde.';
    default:  return 'Error inesperado (HTTP ' + status + '). Intenta de nuevo.';
  }
}

function showDeleteConfirm(accountName, onConfirm) {
  var overlay = document.createElement('div');
  overlay.id = 'delete-confirm-overlay';
  overlay.innerHTML =
    '<div class="delete-confirm-box">' +
      '<div class="delete-confirm-icon">✕</div>' +
      '<div class="delete-confirm-title">¿Eliminar cuenta?</div>' +
      '<div class="delete-confirm-msg">Vas a quitar a <strong>' + escapeHTML(accountName) + '</strong> de la lista.</div>' +
      '<div class="delete-confirm-actions">' +
        '<button class="delete-confirm-btn delete-confirm-btn--cancel" id="delete-cancel-btn">Mantener</button>' +
        '<button class="delete-confirm-btn delete-confirm-btn--remove" id="delete-ok-btn">Sí, quitar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('delete-confirm-overlay--open'); });

  function close() {
    overlay.classList.remove('delete-confirm-overlay--open');
    setTimeout(function() { overlay.remove(); }, 220);
  }

  document.getElementById('delete-ok-btn').addEventListener('click', function() {
    close();
    onConfirm();
  });

  document.getElementById('delete-cancel-btn').addEventListener('click', close);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });

  var escHandler = function(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

// --- Lógica del Modal de Campeones ---
window.openChampModal = function(puuid, champName) {
  const acc = window._accounts_ref?.find(a => a.puuid === puuid);
  if (!acc) return;

  const modal = document.createElement('div');
  modal.id = 'champ-modal';
  modal.className = 'champ-modal';
  modal.innerHTML = buildChampModalHTML(acc, champName);
  
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.classList.add('champ-modal--open'));

  // Cerrar con Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeChampModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
};

window.closeChampModal = function() {
  const modal = document.getElementById('champ-modal');
  if (modal) {
    modal.classList.remove('champ-modal--open');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 300);
  }
};

window.switchChampModal = function(puuid, champName) {
  const modal = document.getElementById('champ-modal');
  if (modal) {
    const acc = window._accounts_ref?.find(a => a.puuid === puuid);
    if (acc) {
      modal.innerHTML = buildChampModalHTML(acc, champName);
    }
  }
};

function buildChampModalHTML(acc, champName) {
  const champMatches = acc.matches.filter(m => m.champion === champName);
  const stats = calculateChampStats(champMatches);
  const top3 = acc.topChampions || [];

  const tabsHTML = top3.map(c => {
    const active = c.name === champName ? 'champ-tab--active' : '';
    return `<div class="champ-tab ${active}" onclick="switchChampModal('${acc.puuid}', '${escapeHTML(c.name)}')">
      <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImageName(c.name)}" />
      <div class="champ-tab-info">
        <span class="champ-tab-name">${escapeHTML(c.name)}</span>
        <span class="champ-tab-points">${(c.points || 0).toLocaleString()} pts</span>
      </div>
    </div>`;
  }).join('');

  const statsGrid = stats ? `
    <div class="stats-source-hint" style="color:var(--gold-primary); text-transform:uppercase; font-size:0.8rem; margin-bottom:15px;">Basado en las últimas ${stats.total} partidas</div>
    <div style="display:flex; flex-wrap:wrap; gap:30px;">
      <!-- Columna Izquierda: Estadísticas Básicas e Impacto -->
      <div style="flex:1; min-width:300px;">
        <div style="color:#fff; font-family:var(--font-title); margin-bottom:10px;">Rendimiento y Básicas</div>
        <div class="player-stats-grid">
          <div class="pstat-card">
            <div class="pstat-label">Winrate</div>
            <div class="pstat-value ${stats.winrate >= 50 ? 'text-win' : 'text-loss'}">${stats.winrate}%</div>
            <div class="pstat-sub">${stats.total} partidas</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">KDA Promedio</div>
            <div class="pstat-value">${stats.kda}</div>
            <div class="pstat-sub">${stats.kills} / ${stats.deaths} / ${stats.assists}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">CS por Minuto</div>
            <div class="pstat-value">${stats.csMin}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Visión</div>
            <div class="pstat-value">${stats.vision}</div>
          </div>
        </div>

        <div style="color:#fff; font-family:var(--font-title); margin:15px 0 10px 0;">Impacto y Objetivos</div>
        <div class="player-stats-grid">
          <div class="pstat-card">
            <div class="pstat-label">Daño / Partida</div>
            <div class="pstat-value">${stats.damage.toLocaleString()}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Daño a Torres</div>
            <div class="pstat-value">${stats.dmgTurret.toLocaleString()}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Objetivos Robados</div>
            <div class="pstat-value">${stats.objStolen}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Solo Kills</div>
            <div class="pstat-value">${stats.soloKills}</div>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Economía y Logros -->
      <div style="flex:1; min-width:300px;">
        <div style="color:#fff; font-family:var(--font-title); margin-bottom:10px;">Economía y Early Game</div>
        <div class="player-stats-grid">
          <div class="pstat-card">
            <div class="pstat-label">Oro por Minuto</div>
            <div class="pstat-value">${stats.goldMin}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Ventaja Oro @15</div>
            <div class="pstat-value ${stats.goldDiff15 >= 0 ? 'text-win' : 'text-loss'}">${stats.goldDiff15 > 0 ? '+' : ''}${stats.goldDiff15}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Ventaja CS @10</div>
            <div class="pstat-value ${stats.csDiff10 >= 0 ? 'text-win' : 'text-loss'}">${stats.csDiff10 > 0 ? '+' : ''}${stats.csDiff10}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Consumibles</div>
            <div class="pstat-value">${stats.consumables}</div>
          </div>
        </div>

        <div style="color:#fff; font-family:var(--font-title); margin:15px 0 10px 0;">Logros y Datos de Impacto</div>
        <div class="player-stats-grid">
          <div class="pstat-card">
            <div class="pstat-label">Pentakills</div>
            <div class="pstat-value" style="color:#f4c874">${stats.penta}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Perfect Games</div>
            <div class="pstat-value" style="color:#f4c874">${stats.perfectGames}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Racha Máxima</div>
            <div class="pstat-value" style="color:#00C65E">${stats.maxWinStreak}</div>
          </div>
          <div class="pstat-card">
            <div class="pstat-label">Duración Prom.</div>
            <div class="pstat-value">${stats.avgDuration} min</div>
          </div>
        </div>
      </div>
    </div>
  ` : '<div class="empty-stats">Sin datos suficientes en el historial reciente</div>';

  return `
    <div class="modal-content">
      <div class="modal-header">
        <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${getChampImageName(champName)}" />
        <div class="names-wrap" style="flex:1;">
          <h2>${escapeHTML(champName)}</h2>
        </div>
        <button class="modal-close" onclick="closeChampModal()">✕</button>
      </div>
      <div style="display:flex; gap:10px; margin-bottom:20px; overflow-x:auto;">${tabsHTML}</div>
      <div>${statsGrid}</div>
    </div>
  `;
}

function calculateChampStats(matches) {
  if (!matches || matches.length === 0) return null;
  const t = matches.length;
  const s = matches.reduce((acc, m) => {
    acc.k += m.kills || 0;
    acc.d += m.deaths || 0;
    acc.a += m.assists || 0;
    acc.cs += m.cs || 0;
    acc.dmg += m.damage || 0;
    acc.dmgT += m.damageTaken || 0;
    acc.dmgObj += m.dmgObj || 0;
    acc.dmgTurret += m.dmgTurret || 0;
    acc.objStolen += m.objStolen || 0;
    acc.firstBlood += m.firstBlood ? 1 : 0;
    acc.penta += m.penta || 0;
    acc.quadra += m.quadra || 0;
    acc.killingSpree = Math.max(acc.killingSpree, m.killingSpree || 0);
    acc.goldDiff15 += m.goldDiff15 || 0;
    acc.csDiff10 += m.csDiff10 || 0;
    acc.consumables += m.consumables || 0;
    acc.solo += m.soloKills || 0;
    acc.vision += m.vision || 0;
    acc.gold += m.gold || 0;
    acc.kp += m.kp || 0;
    acc.dur += m.gameDuration || 0;
    acc.wins += m.win ? 1 : 0;
    
    // Racha actual de victorias
    if (m.win) {
      acc.currStreak++;
      acc.maxStreak = Math.max(acc.maxStreak, acc.currStreak);
    } else {
      acc.currStreak = 0;
    }

    if (m.deaths === 0 && m.win) acc.perfect++;
    if (m.gameDuration > 2100 && m.win) acc.lateWins++; // > 35 min

    return acc;
  }, { k:0, d:0, a:0, cs:0, dmg:0, dmgT:0, dmgObj:0, dmgTurret:0, objStolen:0, firstBlood:0, penta:0, quadra:0, killingSpree:0, goldDiff15:0, csDiff10:0, consumables:0, solo:0, vision:0, gold:0, kp:0, dur:0, wins:0, maxStreak:0, currStreak:0, perfect:0, lateWins:0 });

  const deaths = s.d || 1;
  const durMin = s.dur / 60;
  return {
    total: t,
    winrate: Math.round((s.wins / t) * 100),
    kda: ((s.k + s.a) / deaths).toFixed(2),
    kills: (s.k / t).toFixed(1),
    deaths: (s.d / t).toFixed(1),
    assists: (s.a / t).toFixed(1),
    csMin: (s.cs / durMin).toFixed(1),
    damage: Math.round(s.dmg / t),
    damageTaken: Math.round(s.dmgT / t),
    soloKills: (s.solo / t).toFixed(1),
    vision: (s.vision / t).toFixed(1),
    goldMin: (s.gold / durMin).toFixed(0),
    kp: Math.round(s.kp / t),
    // Nuevas
    dmgObj: Math.round(s.dmgObj / t),
    dmgTurret: Math.round(s.dmgTurret / t),
    objStolen: s.objStolen,
    firstBlood: s.firstBlood,
    penta: s.penta,
    quadra: s.quadra,
    killingSpree: s.killingSpree,
    goldDiff15: Math.round(s.goldDiff15 / t),
    csDiff10: (s.csDiff10 / t).toFixed(1),
    consumables: (s.consumables / t).toFixed(1),
    avgDuration: Math.round(durMin),
    maxWinStreak: s.maxStreak,
    perfectGames: s.perfect,
    lateWins: s.lateWins
  };
}

// --- Lógica del Modal de Jugador (Perfil Detallado) ---
window.openPlayerModal = function(puuid, event) {
  // Si el clic fue en un botón o en un icono de campeón, no abrimos este modal
  // Permitir que el botón de historial abra el modal, pero bloquear otros botones
  if (event && (event.target.closest('.refresh-btn') || event.target.closest('.note-btn') || event.target.closest('.remove-btn') || event.target.closest('.top-champ') || event.target.closest('.top-champ-icon'))) {
    return;
  }

  const acc = window._accounts_ref?.find(a => a.puuid === puuid);
  if (!acc) return;

  // Evitar duplicados
  if (document.getElementById('player-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'player-modal';
  modal.className = 'player-modal';
  modal.innerHTML = buildPlayerModalHTML(acc);
  
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.classList.add('player-modal--open'));

  // Cargar historial de rangos asincrónicamente
  loadRankHistoryUI(puuid);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closePlayerModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
};

window.closePlayerModal = function() {
  const modal = document.getElementById('player-modal');
  if (modal) {
    modal.classList.remove('player-modal--open');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 300);
  }
};

function buildPlayerModalHTML(acc) {
  const stats = calculateGlobalStats(acc.matches);
  const r = getRankInfo(acc);
  const noDivisionTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];
  const rankStr = noDivisionTiers.includes(r.tier) 
    ? r.tier 
    : `${r.tier} ${r.division || ''}`;
  const color = RANK_COLORS[r.tier] || '#fff';
  
  // --- Funcionalidad: Badge de Especialista (Idea 7) ---
  let specialistChamp = null;
  if (acc.matches && acc.matches.length >= 10) {
    const counts = {};
    acc.matches.forEach(m => {
      counts[m.champion] = (counts[m.champion] || 0) + 1;
    });
    for (const champ in counts) {
      if (counts[champ] >= 10) {
        specialistChamp = champ;
        break;
      }
    }
  }
  const specialistHTML = specialistChamp 
    ? '<div class="specialist-badge" title="Especialista en ' + escapeHTML(specialistChamp) + '"><span>OTP</span> ' + escapeHTML(specialistChamp) + '</div>' 
    : '';

  const statsHTML = stats ? `
    <div class="player-stats-grid">
      <div class="pstat-card">
        <div class="pstat-label">Winrate Global</div>
        <div class="pstat-value ${stats.winrate >= 50 ? 'text-win' : 'text-loss'}">${stats.winrate}%</div>
        <div class="pstat-sub">${stats.total} partidas analizadas</div>
        ${stats.winrateTrend ? `<div class="trend-indicator ${stats.winrateTrend > 0 ? 'trend-up' : 'trend-down'}">${stats.winrateTrend > 0 ? '▲' : '▼'} ${Math.abs(stats.winrateTrend)}%</div>` : ''}
      </div>
      <div class="pstat-card">
        <div class="pstat-label">KDA Promedio</div>
        <div class="pstat-value">${stats.kda}</div>
        <div class="pstat-sub">${stats.kills} / ${stats.deaths} / ${stats.assists}</div>
        ${stats.kdaTrend ? `<div class="trend-indicator ${stats.kdaTrend > 0 ? 'trend-up' : 'trend-down'}">${stats.kdaTrend > 0 ? '▲' : '▼'} ${Math.abs(stats.kdaTrend)}</div>` : ''}
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Oro por Minuto</div>
        <div class="pstat-value">${stats.goldMin}</div>
        <div class="pstat-sub">Eficiencia de farmeo</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Mejores Rachas</div>
        <div class="pstat-value text-win">W: ${acc.records?.maxWinStreak || 0}</div>
        <div class="pstat-value text-loss">L: ${acc.records?.maxLossStreak || 0}</div>
        <div class="pstat-sub">Récords históricos</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Daño / Partida</div>
        <div class="pstat-value">${stats.damage.toLocaleString()}</div>
        <div class="pstat-sub">Daño infligido total</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Participación Kills</div>
        <div class="pstat-value">${stats.kp}%</div>
        <div class="pstat-sub">Presencia en el mapa</div>
      </div>
    </div>
    <div class="cstat-group-title" style="margin-top: 12px;">Predicción de Temporada</div>
    ${renderPredictionHTML(acc, stats)}
  ` : '<div class="empty-stats">Actualiza la cuenta para ver estadísticas detalladas</div>';

  // --- Funcionalidad 4: Mapa de calor de posiciones ---
  let heatMapHTML = '';
  if (acc.matches && acc.matches.length > 0) {
    const posCount = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 };
    acc.matches.forEach(m => {
      let p = (m.position || m.teamPosition || '').toUpperCase();
      if (p === 'UTILITY') p = 'SUPPORT'; // Normalizar
      if (posCount[p] !== undefined) posCount[p]++;
      else if (p === 'SUPPORT') posCount.UTILITY++;
    });
    
    const totalPos = Object.values(posCount).reduce((a, b) => a + b, 0) || 1;
    const maxPos = Math.max(...Object.values(posCount), 1);
    
    heatMapHTML = `
      <div class="heatmap-section">
        <div class="cstat-group-title">Roles Jugados</div>
        <div class="heatmap-container">
          ${Object.entries(posCount).map(([pos, count]) => {
            const pct = (count / totalPos) * 100;
            const heightPct = (count / maxPos) * 100; // Altura relativa al rol más jugado
            const iconMap = {
              TOP: '/pic/roll/top_roll.png',
              JUNGLE: '/pic/roll/jungle_roll.png',
              MIDDLE: '/pic/roll/middle_roll.png',
              BOTTOM: '/pic/roll/adc_roll.png',
              UTILITY: '/pic/roll/supp_roll.png'
            };
            const iconUrl = iconMap[pos] || '/pic/roll/all_roll.png';
            const icon = `<img src="${iconUrl}" class="heat-role-icon">`;
            return `
              <div class="heat-col" title="${pos}: ${count} partidas (${Math.round(pct)}%)">
                <div class="heat-bar-bg">
                  <div class="heat-bar-fill" style="height: ${heightPct}%; opacity: ${0.4 + (heightPct/100)*0.6}; background: #d77aa8;"></div>
                </div>
                <div class="heat-icon">${icon}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  // ----------------------------------------------------

  let centeredSplashUrl = '';
  if (acc.topChampions && acc.topChampions.length > 0 && acc.topChampions[0].name) {
    const cName = getChampImageName(acc.topChampions[0].name).replace('.png', '');
    centeredSplashUrl = 'https://ddragon.leagueoflegends.com/cdn/img/champion/centered/' + cName + '_0.jpg';
  }

  return `
    <div class="modal-content">
      <div class="modal-header">
        <img src="${getProfileIconUrl(acc.profileIconId)}" onerror="this.src='${FALLBACK_ICON_URL}'" />
        <div class="names-wrap" style="flex: 1;">
          <h2>${escapeHTML(acc.gameName)} <span style="font-size:1rem; opacity:0.7;">#${escapeHTML(acc.tagLine)}</span></h2>
          ${specialistHTML}
          <p style="color:${color}; margin:0; font-weight:700;">${rankStr} - ${r.lp} LP</p>
        </div>
        <button class="modal-close" onclick="closePlayerModal()">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-wrap: wrap; gap: 30px;">
        <div style="flex: 1; min-width: 300px;">
          <div style="margin-bottom:15px; color:var(--gold-primary); text-transform:uppercase; font-size:0.8rem; letter-spacing:1px; font-weight:800;">Desempeño SoloQ (Últimas 20)</div>
          ${statsHTML}
        </div>
        <div style="flex: 1; min-width: 300px;">
          ${heatMapHTML}
          <div class="rank-history-section" style="margin-top: 20px;">
            <div style="color:var(--gold-primary); margin-bottom:10px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px; font-weight:800;">Progresión de LP</div>
            <div class="lp-chart-wrapper" style="height: 180px; background: rgba(0,0,0,0.3); border-radius:12px; padding:10px;">
              <canvas id="lpChart-${acc.puuid}" class="lp-chart-canvas"></canvas>
            </div>
          </div>
        </div>
        
        <div class="rank-history-section" style="width: 100%; margin-top: 20px;">
          <div style="color:var(--gold-primary); margin-bottom:10px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px; font-weight:800;">Historial de Divisiones</div>
          <div id="rank-history-${acc.puuid}" class="rank-history-container" style="background: rgba(0,0,0,0.3); border-radius:12px; padding:15px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 30px;">
            <div class="empty-stats">Cargando historial...</div>
          </div>
        </div>

        <!-- Nueva Sección: Historial de Partidas -->
        <div class="history-section-modal" style="width: 100%; margin-top: 20px;">
          <div style="color:var(--gold-primary); margin-bottom:15px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px; font-weight:800;">Partidas Recientes (Match History)</div>
          ${buildMatchHistoryHTML(acc.matches, acc.puuid)}
        </div>

      </div>
    </div>
  `;
}

async function loadRankHistoryUI(puuid) {
  const container = document.getElementById(`rank-history-${puuid}`);
  if (!container) return;

  if (typeof getRankHistory !== 'function') {
    container.innerHTML = '<div class="empty-stats">Historial no disponible</div>';
    return;
  }

  const history = await getRankHistory(puuid);
  
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-stats">No hay cambios de rango registrados</div>';
    return;
  }

  container.innerHTML = '<div class="rank-timeline">' + history.map(h => {
    const date = new Date(h.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
    const noDivTiers = ['MASTER','GRANDMASTER','CHALLENGER', 'UNRANKED'];
    const rankStr = noDivTiers.includes(h.rank.tier) ? h.rank.tier : `${h.rank.tier} ${h.rank.division}`;
    return `
      <div class="rank-timeline-item">
        <div class="rank-timeline-dot"></div>
        <div class="rank-timeline-content">
          <span class="rank-timeline-date">${date}</span>
          <span class="rank-timeline-rank">${rankStr} <span class="rank-timeline-lp">${h.rank.lp} LP</span></span>
        </div>
      </div>
    `;
  }).join('') + '</div>';

  // --- Funcionalidad 3: Gráfica de LP ---
  const canvas = document.getElementById(`lpChart-${puuid}`);
  if (canvas && history.length > 1 && window.Chart) {
    // No necesitamos style.display = 'block' porque el wrapper tiene altura fija
    const chartData = [...history].reverse(); // De más antiguo a más nuevo
    
    // Calcular LP continuos (sumando 100 por cada tier/división para ver subidas reales)
    // Para simplificar, solo mostramos los LP como valor, o un puntaje. Mostrar LP es más limpio.
    const labels = chartData.map(h => {
      const d = new Date(h.date);
      return d.getDate() + '/' + (d.getMonth()+1);
    });
    
    const lpData = chartData.map(h => h.rank.lp);
    
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'League Points',
          data: lpData,
          borderColor: '#d77aa8',
          backgroundColor: 'rgba(215, 122, 168, 0.15)',
          borderWidth: 2,
          pointBackgroundColor: '#9d6cff',
          pointBorderColor: '#070810',
          pointRadius: 4,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(23, 28, 48, 0.95)',
            titleColor: '#f2f4ff',
            bodyColor: '#d9b85f',
            borderColor: 'rgba(214, 125, 170, 0.3)',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const h = chartData[context.dataIndex];
                const noDivTiers = ['MASTER','GRANDMASTER','CHALLENGER', 'UNRANKED'];
                const rankStr = noDivTiers.includes(h.rank.tier) ? h.rank.tier : `${h.rank.tier} ${h.rank.division}`;
                return `${rankStr} - ${h.rank.lp} LP`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#657099', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#657099', font: { size: 10 } } }
        }
      }
    });
  } else if (canvas && history.length <= 1) {
    canvas.insertAdjacentHTML('afterend', '<div class="empty-stats" style="margin-bottom:12px;">Actualiza la cuenta varias veces para ver tu progresión en gráfica</div>');
  }
}



function calculateGlobalStats(matches) {
  if (!matches || matches.length === 0) return null;
  const t = matches.length;
  const s = matches.reduce((acc, m) => {
    acc.k += m.kills || 0;
    acc.d += m.deaths || 0;
    acc.a += m.assists || 0;
    acc.cs += m.cs || 0;
    acc.dmg += m.damage || 0;
    acc.vision += m.vision || 0;
    acc.gold += m.gold || 0;
    acc.kp += m.kp || 0;
    acc.dur += m.gameDuration || 0;
    acc.wins += m.win ? 1 : 0;
    return acc;
  }, { k:0, d:0, a:0, cs:0, dmg:0, vision:0, gold:0, kp:0, dur:0, wins:0 });

  const deaths = s.d || 1;
  const totalMin = s.dur / 60;

  // Cálculo de tendencia (primera mitad vs segunda mitad)
  let wrTrend = 0;
  let kdaTrend = 0;
  if (t >= 6) {
    const half = Math.floor(t / 2);
    const m1 = matches.slice(0, half);
    const m2 = matches.slice(half);
    
    const s1 = m1.reduce((a, x) => ({ w: a.w + (x.win?1:0), k: a.k+x.kills, d: a.d+x.deaths, a: a.a+x.assists }), {w:0, k:0, d:0, a:0});
    const s2 = m2.reduce((a, x) => ({ w: a.w + (x.win?1:0), k: a.k+x.kills, d: a.d+x.deaths, a: a.a+x.assists }), {w:0, k:0, d:0, a:0});
    
    const wr1 = (s1.w / m1.length) * 100;
    const wr2 = (s2.w / m2.length) * 100;
    wrTrend = Math.round(wr1 - wr2); // Tendencia positiva si los recientes (m1) son mejores

    const k1 = (s1.k + s1.a) / (s1.d || 1);
    const k2 = (s2.k + s2.a) / (s2.d || 1);
    kdaTrend = parseFloat((k1 - k2).toFixed(2));
  }

  return {
    total: t,
    winrate: Math.round((s.wins / t) * 100),
    winrateTrend: wrTrend,
    kda: ((s.k + s.a) / deaths).toFixed(2),
    kdaTrend: kdaTrend,
    kills: (s.k / t).toFixed(1),
    deaths: (s.d / t).toFixed(1),
    assists: (s.a / t).toFixed(1),
    vision: (s.vision / t).toFixed(1),
    goldMin: (s.gold / totalMin).toFixed(0),
    damage: Math.round(s.dmg / t),
    kp: Math.round(s.kp / t)
  };
}

/* --- Récords Globales (Muro de la Fama) --- */
window.openLeaderboard = function() {
  const accounts = window._accounts_ref || [];
  if (!accounts.length) return;

  const modal = document.createElement('div');
  modal.id = 'leaderboard-modal';
  modal.className = 'leaderboard-modal';
  
  const records = calculateGlobalRecords(accounts);
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="leaderboard-header">
        <div class="leaderboard-title-group">
          <h2>Récords de la Perrera</h2>
          <button class="history-btn-mini" onclick="refreshLeaderboard()">↻ Actualizar</button>
        </div>
        <button class="modal-close" onclick="closeLeaderboard()">✕</button>
      </div>
      <div class="leaderboard-body" id="leaderboard-body-grid">
        <div class="leader-grid">
          ${renderLeaderGridHTML(records)}
        </div>
        <h3 style="font-family: var(--font-title); color: #d93f3f; margin: 30px 0 15px 0;">🤡 Salón de la Vergüenza</h3>
        <div class="leader-grid">
          ${renderLeaderCard('El Imán de Balas', records.maxDeaths, 'Más Muertes Promedio')}
          ${renderLeaderCard('El Topo', records.minVision, 'Menos Visión Promedio')}
          ${renderLeaderCard('El Autofill', records.maxChamps, 'Más Campeones Usados')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.classList.add('leaderboard-modal--open'));
};

window.closeLeaderboard = function() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) {
    modal.classList.remove('leaderboard-modal--open');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 300);
  }
};

window.refreshLeaderboard = function() {
  const accounts = window._accounts_ref || [];
  const container = document.querySelector('#leaderboard-body-grid');
  if (!container) return;
  
  const records = calculateGlobalRecords(accounts);
  container.innerHTML = `
    <div class="leader-grid">
      ${renderLeaderGridHTML(records)}
    </div>
    <h3 style="font-family: var(--font-title); color: #d93f3f; margin: 30px 0 15px 0;">🤡 Salón de la Vergüenza</h3>
    <div class="leader-grid">
      ${renderLeaderCard('El Imán de Balas', records.maxDeaths, 'Más Muertes Promedio')}
      ${renderLeaderCard('El Topo', records.minVision, 'Menos Visión Promedio')}
      ${renderLeaderCard('El Autofill', records.maxChamps, 'Más Campeones Usados')}
    </div>
  `;
};

function renderLeaderGridHTML(records) {
  return `
    ${renderLeaderCard('El Verdugo', records.topKills, 'Kills Promedio')}
    ${renderLeaderCard('Ojos de Halcón', records.topVision, 'Visión Promedio')}
    ${renderLeaderCard('El Rico', records.topGold, 'Oro / Minuto')}
    ${renderLeaderCard('El Más Suertudo', records.topWinrate, 'Winrate Global')}
    ${renderLeaderCard('El Cañón Pulso de Fuego', records.topDamage, 'Daño a Campeones')}
    ${renderLeaderCard('Racha Legendaria', records.topStreak, 'Victorias Consecutivas')}
  `;
}

function calculateGlobalRecords(accounts) {
  const stats = accounts.map(acc => {
    const s = calculateGlobalStats(acc.matches);
    return { acc, s };
  }).filter(x => x.s !== null);

  if (!stats.length) return {};

  return {
    topKills: stats.sort((a,b) => b.s.kills - a.s.kills)[0],
    topVision: stats.sort((a,b) => b.s.vision - a.s.vision)[0],
    topGold: stats.sort((a,b) => b.s.goldMin - a.s.goldMin)[0],
    topWinrate: stats.sort((a,b) => b.s.winrate - a.s.winrate)[0],
    topDamage: stats.sort((a,b) => b.s.damage - a.s.damage)[0],
    minDeaths: stats.sort((a,b) => a.s.deaths - b.s.deaths)[0],
    // Shame
    maxDeaths: stats.sort((a,b) => b.s.deaths - a.s.deaths)[0],
    minVision: stats.sort((a,b) => a.s.vision - b.s.vision)[0],
    topStreak: stats.sort((a,b) => (b.acc.records?.maxWinStreak || 0) - (a.acc.records?.maxWinStreak || 0))[0],
    maxChamps: stats.map(x => {
      const unique = new Set(x.acc.matches.map(m => m.champion)).size;
      return { ...x, unique };
    }).sort((a,b) => b.unique - a.unique)[0]
  };
}

function renderLeaderCard(title, data, sub) {
  if (!data) return '';
  const val = title === 'El Rico' ? data.s.goldMin : 
              title === 'El Más Suertudo' ? data.s.winrate + '%' :
              title === 'El Cañón Pulso de Fuego' ? data.s.damage.toLocaleString() :
              title === 'Ojos de Halcón' ? data.s.vision :
              title === 'El Topo' ? data.s.vision :
              title === 'El Autofill' ? data.unique + ' champs' :
              title === 'Racha Legendaria' ? data.acc.records?.maxWinStreak || 0 : data.s.deaths;
  
  if (title === 'El Verdugo') return renderCard(data.s.kills);
  if (title === 'El Imán de Balas') return renderCard(data.s.deaths);

  function renderCard(displayVal) {
    return `
      <div class="leader-item">
        <div class="leader-label">${title}</div>
        <img style="width:50px; height:50px; border-radius:10px; margin: 10px 0; border: 1px solid var(--gold-dark);" src="${getProfileIconUrl(data.acc.profileIconId)}" onerror="this.src='${FALLBACK_ICON_URL}'" />
        <div class="leader-name">${escapeHTML(data.acc.gameName)}</div>
        <div class="leader-value">${displayVal}</div>
        <div style="font-size:0.7rem; color:#aaa; margin-top:5px;">${sub}</div>
      </div>
    `;
  }

  return renderCard(val);
}

/* --- Funcionalidad 1: Notas por cuenta --- */
window.openNoteModal = function(puuid) {
  const acc = window._accounts_ref?.find(a => a.puuid === puuid);
  if (!acc) return;

  const modal = document.createElement('div');
  modal.id = 'note-modal';
  modal.className = 'note-modal';
  
  const currentNote = escapeHTML(acc.notes || '');
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 style="margin:0;">Notas: ${escapeHTML(acc.gameName)}</h2>
        <button class="modal-close" onclick="closeNoteModal()">✕</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:15px;">
        <textarea id="note-textarea-${puuid}" style="width:100%; height:120px; background:rgba(0,0,0,0.3); border:1px solid var(--gold-dark); color:#fff; padding:15px; border-radius:8px; resize:none; outline:none;" maxlength="200" placeholder="Añade una nota sobre este jugador (máx 200 caracteres)...">${currentNote}</textarea>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span id="note-counter-${puuid}" style="color:var(--gold-primary); font-size:0.8rem;">${currentNote.length}/200</span>
          <div style="display:flex; gap:10px;">
            <button onclick="closeNoteModal()" style="background:transparent; border:1px solid #d93f3f; color:#d93f3f; padding:8px 15px; border-radius:6px; cursor:pointer;">Cancelar</button>
            <button class="note-save" onclick="saveNote('${puuid}')" style="background:var(--gold-primary); border:none; color:#000; padding:8px 15px; border-radius:6px; font-weight:800; cursor:pointer;">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.classList.add('note-modal--open'));

  const textarea = document.getElementById(`note-textarea-${puuid}`);
  const counter = document.getElementById(`note-counter-${puuid}`);
  
  if (textarea && counter) {
    textarea.focus();
    textarea.addEventListener('input', () => {
      counter.textContent = `${textarea.value.length}/200`;
    });
  }

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeNoteModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
};

window.closeNoteModal = function() {
  const modal = document.getElementById('note-modal');
  if (modal) {
    modal.classList.remove('note-modal--open');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 300);
  }
};

function renderPredictionHTML(acc, stats) {
  if (!stats) return '';
  // Ajustado según el tiempo real del split actual
  const seasonEnd = new Date('2026-04-29T03:12:00'); 
  const now = new Date();
  const diffMs = seasonEnd - now;
  const daysLeft = Math.max(0, diffMs / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.max(0, diffMs / (60 * 60 * 1000));
  
  // Si queda menos de un día, el cálculo cambia a "Último empujón"
  let totalGames = 0;
  let timeDesc = '';
  
  if (daysLeft > 7) {
    const weeks = Math.ceil(daysLeft / 7);
    totalGames = weeks * 10; // 10 partidas/semana
    timeDesc = `${weeks} semanas`;
  } else if (daysLeft >= 1) {
    totalGames = Math.floor(daysLeft * 3); // 3 partidas/día
    timeDesc = `${Math.floor(daysLeft)} días`;
  } else {
    totalGames = Math.floor(hoursLeft / 0.75); // Partidas de 45min
    timeDesc = `${Math.floor(hoursLeft)} horas`;
  }
  
  const netWins = (stats.winrate / 100 - 0.5) * 2 * totalGames;
  const lpChange = Math.round(netWins * 22);
  
  const currentLP = acc.soloQ?.leaguePoints || 0;
  const projectedLP = currentLP + lpChange;
  
  // Lógica de rango predicho (simplificada)
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
  let currentTierIdx = tiers.indexOf(acc.soloQ?.tier || 'SILVER');
  if (currentTierIdx === -1) currentTierIdx = 2; // Default Silver
  let finalTierIdx = currentTierIdx + Math.floor(projectedLP / 400);
  finalTierIdx = Math.max(0, Math.min(tiers.length - 1, finalTierIdx));
  const finalTier = tiers[finalTierIdx];

  const messages = {
    high: [
      "¡Estás imparable! El elo inflado es real, ¡aprovéchalo!",
      "Dominando la grieta como un profesional. ¡Sigue así!",
      "Tu desempeño es excepcional. La cima está cerca.",
      "Vas por excelente camino, ¡estás smurfeando!"
    ],
    mid: [
      "Mantén la consistencia y el ascenso será inevitable.",
      "Buen ritmo. Un par de victorias más y rompes la liga.",
      "Estás en el punto de equilibrio. ¡Es hora de dar el 110%!",
      "Jugando sólido. El diamante no se va a subir solo."
    ],
    low: [
      "No te rindas, cada derrota es una lección aprendida.",
      "Con un poco más de enfoque llegarás lejos. ¡A por ello!",
      "El camino al éxito está lleno de baches. ¡Tú puedes remontar!",
      "Ánimo, hasta los mejores tienen rachas malas. ¡A por la siguiente!"
    ]
  };

  let msgPool = messages.mid;
  if (stats.winrate >= 53) msgPool = messages.high;
  else if (stats.winrate <= 48) msgPool = messages.low;
  
  const randomMsg = msgPool[Math.floor(Math.random() * msgPool.length)];

  return `
    <div class="prediction-box">
      <div class="prediction-rank">
        <img src="/pic/ranks/${finalTier.toLowerCase()}.png" class="prediction-icon" />
        <div class="prediction-info">
          <div class="prediction-title">Rango Final Predicho: ${finalTier}</div>
          <div class="prediction-desc">Basado en tu winrate de ${stats.winrate}% y ${timeDesc} restantes.</div>
        </div>
      </div>
      <div class="prediction-message">"${randomMsg}"</div>
    </div>
  `;
}

window.openTournamentModal = async function() {
  const modal = document.createElement('div');
  modal.id = 'tournament-modal';
  modal.className = 'tournament-modal';
  const tournaments = await fetch('/tournaments').then(r => r.json());
  
  modal.innerHTML = `
    <div class="tournament-box">
      <div class="tournament-header">
        <div class="tournament-title-group">
          <span class="t-emoji">🏆</span>
          <h2>Gestión de Torneos</h2>
        </div>
        <button class="modal-close" onclick="closeTournamentModal()">✕</button>
      </div>
      <div class="tournament-body">
        <div class="t-actions">
           <button class="btn-primary" onclick="showCreateTournament()">Crear Nuevo Torneo</button>
        </div>
        <div class="tournament-list">
          ${tournaments.length === 0 ? '<div class="empty-stats">No hay torneos creados aún</div>' : tournaments.map(t => `
            <div class="tournament-item" onclick="viewTournament('${t._id}')">
              <span class="t-name">${escapeHTML(t.name)}</span>
              <span class="t-status status-${t.status}">${t.status.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
};

window.closeTournamentModal = () => {
  const m = document.getElementById('tournament-modal');
  if (m) m.remove();
  document.body.classList.remove('modal-open');
};

window.showCreateTournament = function() {
  const body = document.querySelector('.tournament-body');
  const accounts = window._accounts_ref || [];
  body.innerHTML = `
    <div class="create-tournament">
      <div class="t-input-group">
        <label>Nombre del Torneo</label>
        <input type="text" id="t-name" placeholder="Ej: Torneo de Verano" />
      </div>
      <div class="participant-selector">
        <p>Seleccionar participantes (mínimo 2):</p>
        <div class="p-list">
          ${accounts.map(a => `
            <label class="p-item"><input type="checkbox" value="${a.puuid}" class="t-participant"> ${a.gameName}</label>
          `).join('')}
        </div>
      </div>
      <div class="t-actions">
        <button class="btn-cancel" onclick="openTournamentModal()">Cancelar</button>
        <button class="btn-save" onclick="saveTournament()">Generar Bracket</button>
      </div>
    </div>
  `;
};

window.showCustomAlert = function(title, message) {
  return new Promise(resolve => {
    const dialog = document.getElementById('customDialog');
    document.getElementById('cd-title').textContent = title;
    document.getElementById('cd-message').textContent = message;
    document.getElementById('cd-input').style.display = 'none';
    
    const cancelBtn = document.getElementById('cd-cancel');
    const confirmBtn = document.getElementById('cd-confirm');
    
    cancelBtn.style.display = 'none'; // Alert solo tiene Aceptar
    
    const cleanup = () => {
      dialog.style.display = 'none';
      confirmBtn.onclick = null;
    };
    
    confirmBtn.onclick = () => { cleanup(); resolve(true); };
    dialog.style.display = 'flex';
  });
};

window.saveTournament = async function() {
  const name = document.getElementById('t-name').value;
  const selected = Array.from(document.querySelectorAll('.t-participant:checked')).map(i => i.value);
  if (!name || selected.length < 2) return showCustomAlert('Datos insuficientes', 'Debes ingresar un nombre y seleccionar al menos 2 participantes.');
  
  await fetch('/tournaments', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name, participants: selected, status: 'pendiente', date: new Date().toISOString() })
  });
  openTournamentModal();
};

window.viewTournament = async function(id) {
  showCustomAlert('Torneo', 'Visualización de bracket para el ID: ' + id + ' (En desarrollo)');
};

/* ---- Funcionalidad: Feed de Actividad ---- */
async function renderActivityFeed() {
  const container = document.getElementById('activity-feed');
  if (!container) return;
  
  try {
    const res = await fetch('/activities');
    const logs = await res.json();
    
    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="empty-state-mini">Sin actividad reciente.</div>';
      return;
    }

    // --- Apertura automática si hay nuevas actividades ---
    const lastCount = parseInt(sessionStorage.getItem('last_activity_count') || '0');
    if (logs.length > lastCount && lastCount > 0) {
      openActivitySidebar(true); // Abrir con timer
    }
    sessionStorage.setItem('last_activity_count', logs.length);

    const TYPE_ICON = {
      level_up:      '📈',
      lose_streak:   '📉',
      live:          '🔴',
      goal:          '🎯',
      challenge_win: '🏆',
      bet_win:       '💰',
      bet_loss:      '💸',
    };

    container.innerHTML = logs.map(function(log) {
      const icon = TYPE_ICON[log.type] || '📋';
      return '<div class="activity-item activity-item--' + log.type + '">' +
        '<div class="activity-msg"><span style="margin-right:6px;">' + icon + '</span>' + log.message + '</div>' +
        '<div class="activity-time">' + formatRelativeTime(log.timestamp) + '</div>' +
      '</div>';
    }).join('');
  } catch(e) {}
}

let activityCloseTimer = null;
let isActivityPinned = false;

function openActivitySidebar(withTimer = false) {
  const sidebar = document.getElementById('activity-sidebar');
  const toggle = document.getElementById('activity-toggle');
  if (!sidebar) return;

  sidebar.classList.remove('collapsed');
  if (toggle) toggle.textContent = '»'; // » = cerrar (empujar hacia la derecha)

  if (withTimer && !isActivityPinned) {
    if (activityCloseTimer) clearTimeout(activityCloseTimer);
    activityCloseTimer = setTimeout(() => {
      if (!isActivityPinned) closeActivitySidebar();
    }, 5000);
  }
}

function closeActivitySidebar() {
  const sidebar = document.getElementById('activity-sidebar');
  const toggle = document.getElementById('activity-toggle');
  if (!sidebar) return;

  sidebar.classList.add('collapsed');
  if (toggle) toggle.textContent = '«'; // « = abrir (jalar hacia la izquierda)
}

function toggleActivityPin(e) {
  if (e) e.stopPropagation();
  const btn = document.getElementById('activity-pin');
  isActivityPinned = !isActivityPinned;
  
  if (btn) {
    btn.classList.toggle('activity-pin--active', isActivityPinned);
    btn.style.opacity = isActivityPinned ? '1' : '0.5';
    btn.style.color   = isActivityPinned ? 'var(--gold-primary)' : '';
    btn.title = isActivityPinned ? 'Panel fijado (clic para desfijar)' : 'Fijar panel';
  }
  
  if (isActivityPinned) {
    if (activityCloseTimer) clearTimeout(activityCloseTimer);
  } else {
    // Si deseleccionamos el pin y está abierto, programar cierre en 5s
    const sidebar = document.getElementById('activity-sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      if (activityCloseTimer) clearTimeout(activityCloseTimer);
      activityCloseTimer = setTimeout(() => {
        if (!isActivityPinned) closeActivitySidebar();
      }, 5000);
    }
  }
}

function formatRelativeTime(timestamp) {
  const diff = new Date() - new Date(timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return 'Hace ' + mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return 'Hace ' + hrs + 'h';
  return new Date(timestamp).toLocaleDateString();
}

// Inicializar al cargar (IIFE — scripts están al final del body, DOM ya existe)
(function initActivitySidebar() {
  renderActivityFeed();
  setInterval(renderActivityFeed, 30000);
  
  const sidebar   = document.getElementById('activity-sidebar');
  const toggleBtn = document.getElementById('activity-toggle');
  const pinBtn    = document.getElementById('activity-pin');

  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('collapsed')) {
        openActivitySidebar(true);
      } else {
        closeActivitySidebar();
      }
    });
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', toggleActivityPin);
  }
})();

/* --- Hall of Fame Rendering --- */
window.openHof = async function() {
  const modal = document.getElementById('hof-modal');
  const body  = document.getElementById('hof-body');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  body.innerHTML = '<div class="empty-state-mini">Invocando historia...</div>';

  try {
    const res = await fetch('/splits');
    const splits = await res.json();
    renderHallOfFame(splits);
  } catch(e) {
    body.innerHTML = '<div class="error-msg">Error al cargar la historia</div>';
  }
};

window.closeHof = function() {
  const modal = document.getElementById('hof-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
};

function renderHallOfFame(splits) {
  const body = document.getElementById('hof-body');
  if (!body) return;

  if (!splits || splits.length === 0) {
    body.innerHTML = '<div class="empty-state-mini">Aún no hay splits archivados. ¡Haz historia hoy!</div>';
    return;
  }

  body.innerHTML = splits.map(split => {
    // Tomar top 3 para el podio, resto para la tabla
    const top3 = split.rankings.slice(0, 3);
    const others = split.rankings.slice(3);

    const podiumHTML = top3.map((player, idx) => {
      const place = idx + 1;
      const rankIcon = RANK_ICONS[player.tier] || RANK_ICONS.UNRANKED;
      return `
        <div class="podium-place place-${place}">
          <img class="podium-rank-img" src="${rankIcon}" alt="${player.tier}" />
          <div class="podium-name">${escapeHTML(player.gameName)}</div>
          <div class="podium-tier">${player.tier} ${player.rank}</div>
        </div>
      `;
    }).join('');

    const tableHTML = others.length > 0 ? `
      <table class="hof-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Jugador</th>
            <th>Rango Final</th>
            <th>LP</th>
          </tr>
        </thead>
        <tbody>
          ${others.map((p, i) => `
            <tr>
              <td>${i + 4}</td>
              <td>
                <img class="hof-mini-icon" src="${getProfileIconUrl(p.profileIconId)}" />
                ${escapeHTML(p.gameName)}#${escapeHTML(p.tagLine)}
              </td>
              <td>${p.tier} ${p.rank}</td>
              <td>${p.lp} LP</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    return `
      <div class="split-record">
        <div class="split-header">
          <h3>${escapeHTML(split.name)}</h3>
          <small>${new Date(split.date).toLocaleDateString()}</small>
        </div>
        <div class="podium-container">
          ${podiumHTML}
        </div>
        ${tableHTML}
      </div>
    `;
  }).join('');
}

/* --- Lógica del Modal de Detalles de Partida --- */
window.openMatchModal = async function(matchId) {
  const modal = document.getElementById('matchModal');
  const body = document.getElementById('modalBody');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  body.innerHTML = '<div class="loading-modal"><div class="spinner"></div><p>Obteniendo scoreboard desde Riot Games...</p></div>';

  try {
    const res = await fetch('/api/match/' + matchId);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderScoreboard(data);
  } catch(e) {
    body.innerHTML = '<div style="text-align:center; padding:40px; color:#ff4b4b;"><h3>Error al cargar partida</h3><p>' + e.message + '</p></div>';
  }
};

window.closeMatchModal = function(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
  const modal = document.getElementById('matchModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    const body = document.getElementById('modalBody');
    if (body) body.innerHTML = ''; 
  }
};

function renderScoreboard(data) {
  const body = document.getElementById('modalBody');
  const duration = Math.floor(data.gameDuration / 60) + 'm ' + (data.gameDuration % 60) + 's';
  
  let html = '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">';
  html += '<div><h2 style="margin:0;">Detalles de la Partida</h2><div style="color:#657099; font-size:0.8rem;">' + (data.gameMode || 'Normal') + ' • ' + duration + '</div></div>';
  html += '</div>';

  html += '<div class="modal-tabs">';
  html += '<div class="modal-tab active" onclick="switchTab(event, \'tab-scoreboard\')">SCOREBOARD</div>';
  html += '<div class="modal-tab" onclick="switchTab(event, \'tab-stats\')">DAÑO Y ORO</div>';
  html += '</div>';

  html += renderScoreboardContent(data);
  body.innerHTML = html;
}

window.switchTab = function(e, tabId) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
};

function renderScoreboardContent(data) {
  const blueTeam = data.participants.filter(p => p.teamId === 100);
  const redTeam = data.participants.filter(p => p.teamId === 200);
  const maxDmg = Math.max(...data.participants.map(p => p.totalDamageDealtToChampions));
  
  let html = '<div id="tab-scoreboard" class="tab-content active">';
  html += renderTeamTable('Equipo Azul', blueTeam, 'blue-team', data.teams[100], maxDmg, data.gameDuration);
  html += '<div style="height:15px;"></div>';
  html += renderTeamTable('Equipo Rojo', redTeam, 'red-team', data.teams[200], maxDmg, data.gameDuration);
  html += '</div>';
  html += '<div id="tab-stats" class="tab-content">' + renderStatsContent(data) + '</div>';

  return html;
}

/* --- Diálogos Personalizados Premium --- */
window.showCustomConfirm = function(title, message) {
  return new Promise(resolve => {
    const dialog = document.getElementById('customDialog');
    document.getElementById('cd-title').textContent = title;
    document.getElementById('cd-message').textContent = message;
    
    const input = document.getElementById('cd-input');
    input.style.display = 'none';
    input.value = '';
    
    const cancelBtn = document.getElementById('cd-cancel');
    const confirmBtn = document.getElementById('cd-confirm');
    
    cancelBtn.style.display = 'block';
    
    const cleanup = () => {
      dialog.style.display = 'none';
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
    };
    
    cancelBtn.onclick = () => { cleanup(); resolve(false); };
    confirmBtn.onclick = () => { cleanup(); resolve(true); };
    
    dialog.style.display = 'flex';
  });
};

window.showCustomPrompt = function(title, message, defaultValue = '') {
  return new Promise(resolve => {
    const dialog = document.getElementById('customDialog');
    document.getElementById('cd-title').textContent = title;
    document.getElementById('cd-message').textContent = message;
    
    const input = document.getElementById('cd-input');
    input.style.display = 'block';
    input.value = defaultValue;
    
    const cancelBtn = document.getElementById('cd-cancel');
    const confirmBtn = document.getElementById('cd-confirm');
    
    cancelBtn.style.display = 'block';
    
    const cleanup = () => {
      dialog.style.display = 'none';
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      input.onkeydown = null;
    };
    
    cancelBtn.onclick = () => { cleanup(); resolve(null); };
    confirmBtn.onclick = () => { cleanup(); resolve(input.value); };
    input.onkeydown = (e) => { if(e.key === 'Enter') confirmBtn.click(); };
    
    dialog.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  });
};

function renderStatsContent(data) {
  let html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:20px;">';
  if (data.timeline) {
    html += '<div><h3 style="font-size:0.9rem; margin-bottom:10px; color:#f2f4ff; text-align:center;">Ventaja de Oro</h3><div style="height:280px; background:rgba(0,0,0,0.2); border-radius:12px; padding:10px;"><canvas id="goldChart"></canvas></div></div>';
  }
  html += '<div><h3 style="font-size:0.9rem; margin-bottom:10px; color:#f2f4ff; text-align:center;">Daño Infligido</h3><div style="height:280px; background:rgba(0,0,0,0.2); border-radius:12px; padding:10px 15px; position:relative; overflow:hidden;"><canvas id="dmgChart"></canvas></div></div>';
  html += '</div>';
  setTimeout(() => initCharts(data), 100);
  return html;
}

function initCharts(data) {
  if (data.timeline && document.getElementById('goldChart')) {
    const ctx = document.getElementById('goldChart').getContext('2d');
    const labels = data.timeline.map((_, i) => i + 'm');
    const goldData = data.timeline.map(f => f.goldDiff);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventaja (Azul vs Rojo)',
          data: goldData,
          borderColor: (context) => {
            const chart = context.chart;
            const {ctx, chartArea, scales} = chart;
            if (!chartArea || !scales.y) return '#00b4ff';
            const zeroY = scales.y.getPixelForValue(0);
            const diff = chartArea.bottom - chartArea.top;
            let zeroPos = diff > 0 ? (zeroY - chartArea.top) / diff : 0.5;
            if (!isFinite(zeroPos)) zeroPos = 0.5;
            zeroPos = Math.min(Math.max(zeroPos, 0), 1);

            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, '#00b4ff');
            gradient.addColorStop(zeroPos, '#00b4ff');
            gradient.addColorStop(zeroPos, '#ff4b4b');
            gradient.addColorStop(1, '#ff4b4b');
            return gradient;
          },
          backgroundColor: (context) => {
            const chart = context.chart;
            const {ctx, chartArea, scales} = chart;
            if (!chartArea || !scales.y) return 'transparent';
            const zeroY = scales.y.getPixelForValue(0);
            const diff = chartArea.bottom - chartArea.top;
            let zeroPos = diff > 0 ? (zeroY - chartArea.top) / diff : 0.5;
            if (!isFinite(zeroPos)) zeroPos = 0.5;
            zeroPos = Math.min(Math.max(zeroPos, 0), 1);

            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(0, 180, 255, 0.4)');
            gradient.addColorStop(zeroPos, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(zeroPos, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(255, 75, 75, 0.4)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#657099' } },
          x: { grid: { display: false }, ticks: { color: '#657099', font: { size: 9 } } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  if (document.getElementById('dmgChart')) {
    const ctx = document.getElementById('dmgChart').getContext('2d');
    const sorted = [...data.participants].sort((a,b) => a.teamId - b.teamId);
    const labels = sorted.map(p => p.championName);
    const dmgData = sorted.map(p => p.totalDamageDealtToChampions);
    const colors = sorted.map(p => p.teamId === 100 ? 'rgba(0, 180, 255, 0.7)' : 'rgba(255, 75, 75, 0.7)');
    const borders = sorted.map(p => p.teamId === 100 ? '#00b4ff' : '#ff4b4b');

    const images = sorted.map(p => {
      const img = new Image();
      img.src = 'https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/champion/' + getChampImageName(p.championName);
      return img;
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: dmgData,
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { bottom: 25 } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#657099', font: { size: 9 } } },
          x: { display: false }
        },
        plugins: { legend: { display: false } }
      },
      plugins: [{
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          const xAxis = chart.scales.x;
          if (!xAxis || !meta.data.length) return;
          const bottom = xAxis.bottom;
          
          images.forEach((img, i) => {
            if (img.complete && img.naturalWidth > 0 && meta.data[i]) {
              const x = meta.data[i].x;
              const size = 18;
              ctx.drawImage(img, x - size/2, bottom + 5, size, size);
              ctx.strokeStyle = 'rgba(255,255,255,0.15)';
              ctx.lineWidth = 1;
              ctx.strokeRect(x - size/2, bottom + 5, size, size);
            } else {
              img.onload = () => chart.draw();
            }
          });
        }
      }]
    });
  }
}

const SPELL_MAP = {
  1: 'SummonerBoost', 3: 'SummonerExhaust', 4: 'SummonerFlash', 6: 'SummonerHaste',
  7: 'SummonerHeal', 11: 'SummonerSmite', 12: 'SummonerTeleport', 13: 'SummonerMana',
  14: 'SummonerDot', 21: 'SummonerBarrier', 32: 'SummonerSnowball'
};

function renderTeamTable(title, players, teamClass, teamData, maxDmg, gameDuration) {
  const result = players[0].win ? 'VICTORIA' : 'DERROTA';
  const kills = players.reduce((sum, p) => sum + p.kills, 0);
  const deaths = players.reduce((sum, p) => sum + p.deaths, 0);
  const assists = players.reduce((sum, p) => sum + p.assists, 0);
  const gold = (players.reduce((sum, p) => sum + p.goldEarned, 0) / 1000).toFixed(1);

  let html = '<div class="team-header ' + teamClass + '">';
  html += '<span class="team-title">' + title + ' (' + result + ')</span>';
  html += '<div class="team-summary-stats">';
  html += '<span>' + kills + ' / ' + deaths + ' / ' + assists + '</span>';
  html += '<span class="team-summary-gold">💰 ' + gold + 'k</span>';
  if (teamData && teamData.objectives) {
    html += '<span>🗼 ' + (teamData.objectives.tower?.kills || 0) + '</span>';
    html += '<span>🐉 ' + (teamData.objectives.dragon?.kills || 0) + '</span>';
  }
  html += '</div></div>';

  html += '<div class="table-container"><table class="scoreboard-table">';
  html += '<thead><tr><th>Jugador</th><th>KDA</th><th>Daño</th><th>Visión</th><th>CS</th><th>Oro</th><th>Objetos</th></tr></thead>';
  html += '<tbody>';

  players.forEach(p => {
    const kdaRatio = p.deaths === 0 ? (p.kills + p.assists) : ((p.kills + p.assists) / p.deaths).toFixed(2);
    const dmgPct = (p.totalDamageDealtToChampions / maxDmg) * 100;
    const durationMin = gameDuration / 60 || 1;
    const csPerMin = (p.totalMinionsKilled / durationMin).toFixed(1);
    
    html += '<tr>';
    html += '<td><div class="player-cell">';
    html += '<div class="champ-icon-wrapper">';
    html += '<img src="https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/champion/' + getChampImageName(p.championName) + '" class="player-champ-icon">';
    html += '</div>';
    
    html += '<div class="spells-runes">';
    html += '<img src="https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/spell/' + (SPELL_MAP[p.summoner1Id] || 'SummonerFlash') + '.png" class="spell-icon">';
    html += '<img src="https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/spell/' + (SPELL_MAP[p.summoner2Id] || 'SummonerDot') + '.png" class="spell-icon">';
    html += '</div>';

    html += '<div class="player-info-meta"><span class="player-name-link">' + p.gameName + '</span><span class="player-level-text">Nivel ' + p.champLevel + '</span></div>';
    html += '</div></td>';
    
    html += '<td><div class="kda-block"><span class="score-kda">' + p.kills + ' / ' + p.deaths + ' / ' + p.assists + '</span><span class="score-sub">' + kdaRatio + ' KDA</span></div></td>';
    
    html += '<td>';
    html += '<div class="dmg-bar-container"><div class="dmg-bar-fill" style="width:' + dmgPct + '%"></div><div class="dmg-bar-text">' + p.totalDamageDealtToChampions.toLocaleString() + '</div></div>';
    html += '</td>';

    html += '<td><span class="score-kda">' + p.visionScore + '</span></td>';
    html += '<td><div class="cs-block"><span class="score-kda">' + p.totalMinionsKilled + '</span><span class="score-sub">' + csPerMin + '/m</span></div></td>';
    html += '<td><span class="score-kda">' + (p.goldEarned/1000).toFixed(1) + 'k</span></td>';
    
    html += '<td><div class="item-list">';
    (p.items || [0,0,0,0,0,0,0]).forEach(itemId => {
      if (itemId > 0) {
        html += '<img src="https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VERSION + '/img/item/' + itemId + '.png" class="item-icon">';
      } else {
        html += '<div class="empty-item"></div>';
      }
    });
    html += '</div></td>';
    
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}