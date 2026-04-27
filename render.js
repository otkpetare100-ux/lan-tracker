/**
 * render.js — DOM rendering helpers for LAN Tracker
 */

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
  'AurelionSol': 'AurelionSol', 'Belveth': 'Belveth', 'Chogath': 'Chogath',
  'DrMundo': 'DrMundo', 'JarvanIV': 'JarvanIV', 'Kaisa': 'Kaisa',
  'Khazix': 'Khazix', 'KogMaw': 'KogMaw', 'KSante': 'KSante',
  'Leblanc': 'Leblanc', 'LeeSin': 'LeeSin', 'MasterYi': 'MasterYi',
  'MissFortune': 'MissFortune', 'MonkeyKing': 'MonkeyKing', 'Wukong': 'MonkeyKing',
  'Nunu': 'Nunu', 'NunuWillump': 'Nunu', 'RekSai': 'RekSai',
  'TahmKench': 'TahmKench', 'TwistedFate': 'TwistedFate', 'Velkoz': 'Velkoz',
  'XinZhao': 'XinZhao', 'Fiddlesticks': 'Fiddlesticks', 'FiddleSticks': 'Fiddlesticks',
  'fiddlesticks': 'Fiddlesticks', 'Renata': 'Renata', 'RenataGlasc': 'Renata', 'Mel': 'Mel',
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
  if (wr >= 48) return 'ok';
  return 'bad';
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

function getChampImageName(name) {
  if (!name) return 'Unknown.png';
  var base  = name.replace(/\.png$/i, '');
  var clean = base.replace(/[^a-zA-Z0-9]/g, '');
  return (CHAMP_NAME_FIX[clean] || CHAMP_NAME_FIX[base] || clean) + '.png';
}

function buildStreakHTML(streak) {
  if (!streak || streak === 0) return '';
  const isWin = streak > 0;
  const cls   = isWin ? 'streak-win' : 'streak-loss';
  const label = Math.abs(streak) + (isWin ? 'V seguidas' : 'D seguidas');
  return '<span class="streak-badge ' + cls + '">' + label + '</span>';
}

function buildMatchHistoryHTML(matches) {
  if (!matches || matches.length === 0) return '<div class="match-empty">Sin partidas registradas</div>';
  return '<div class="match-history">' + matches.map(function(m) {
    const cls = m.win ? 'match-win' : 'match-loss';
    const kda = m.kills + '/' + m.deaths + '/' + m.assists;
    const dur = formatDuration(m.gameDuration);
    const img = 'https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/' + getChampImageName(m.champion);
    return '<div class="match-item ' + cls + '">' +
      '<img class="match-champ" src="' + img + '" alt="' + escapeHTML(m.champion) + '" onerror="this.style.display=\'none\'" />' +
      '<div class="match-result-dot ' + (m.win ? 'dot-win' : 'dot-loss') + '"></div>' +
      '<span class="match-champ-name">' + escapeHTML(m.champion) + '</span>' +
      '<span class="match-kda">' + kda + '</span>' +
      '<span class="match-dur">' + dur + '</span>' +
    '</div>';
  }).join('') + '</div>';
}

function buildTopChampsHTML(topChampions, puuid) {
  if (!topChampions || topChampions.length === 0) return '';
  return topChampions.map(function(c) {
    if (!c.name) return '';
    var img = 'https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/' + getChampImageName(c.name);
    return '<div class="top-champ" title="Ver estadísticas de ' + escapeHTML(c.name) + '" onclick="openChampModal(\'' + puuid + '\', \'' + escapeHTML(c.name) + '\')">' +
      '<img src="' + img + '" alt="' + escapeHTML(c.name) + '" onerror="this.style.display=\'none\'" />' +
    '</div>';
  }).join('');
}

function buildMatchDots(matches) {
  if (!matches || matches.length === 0) return '';
  return '<div class="match-dots">' +
    matches.slice(0, 5).map(function(m) {
      return '<span class="mdot ' + (m.win ? 'mdot--w' : 'mdot--l') + '" title="' + (m.win ? 'Victoria' : 'Derrota') + ' · ' + escapeHTML(m.champion || '') + '"></span>';
    }).join('') +
  '</div>';
}

function buildCardHTML(acc, position) {
  const r          = getRankInfo(acc);
  const wr         = computeWinrate(r.wins, r.losses);
  const wrCls      = winrateClass(wr);
  const color      = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
  const rankStr    = r.tier === 'UNRANKED' ? 'Sin clasificar' : titleCase(r.tier) + ' ' + (r.rank || '');
  const iconUrl    = getProfileIconUrl(acc.profileIconId);

  const updatedStr    = acc.updatedAt
    ? 'Act: ' + new Date(acc.updatedAt).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})
    : '';
  const posLabel      = acc.mainPosition || '—';
  const streak        = buildStreakHTML(acc.streak);
  const recentDots    = buildMatchDots(acc.matches);
  const watermarkHTML = RANK_ICONS[r.tier]
    ? '<div class="rank-watermark"><img src="' + RANK_ICONS[r.tier] + '" alt="" /></div>'
    : '';

  const wrHTML = wr !== null
    ? '<div class="wr-number ' + wrCls + '">' + wr + '%</div><div class="wr-label">Winrate</div><div class="wr-games">' + r.wins + 'V ' + r.losses + 'D</div>'
    : '<div class="wr-number empty">—</div><div class="wr-label">Sin partidas</div>';

  const hasFrame = r.tier && r.tier.toUpperCase() !== 'UNRANKED';
  const frameHTML = hasFrame 
    ? '<img src="/pic/frame/' + r.tier.toLowerCase() + '-frame.png" class="rank-frame frame-' + r.tier.toLowerCase() + '" onerror="this.remove()">' 
    : '';

  const rankIconHTML = RANK_ICONS[r.tier]
    ? '<img src="' + RANK_ICONS[r.tier] + '" alt="' + r.tier + '" class="rank-icon" />'
    : '❓';

  const historyBtn = '<button class="history-toggle-btn" data-puuid="' + acc.puuid + '">' +
    '<span class="history-btn-text">Ver historial</span><span class="history-arrow">▾</span>' +
  '</button>';

  return watermarkHTML +
  '<div class="card-top">' +
    '<div class="icon-wrap">' +
      frameHTML +
      '<img class="profile-main-icon" src="' + iconUrl + '" alt="Icono" onerror="this.src=\'' + FALLBACK_ICON_URL + '\'" />' +
      '<span class="icon-level">' + acc.summonerLevel + '</span>' +
    '</div>' +
    '<div class="summoner-info" title="Ver perfil detallado">' +
      '<div class="summoner-name">' + escapeHTML(acc.gameName) + '</div>' +
      '<div class="summoner-tag">#' + escapeHTML(acc.tagLine) + '</div>' +
      '<div class="summoner-meta">' +
        '<span class="summoner-region">LAN</span>' +
        '<span class="position-badge">' + escapeHTML(posLabel) + '</span>' +
        streak +
        recentDots +
        (updatedStr ? '<span class="updated-time">' + updatedStr + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="top-champs-block"><div class="top-champs-inner">' + buildTopChampsHTML(acc.topChampions, acc.puuid) + '</div></div>' +
    '<div class="rank-block">' +
      '<div class="rank-emblem">' + rankIconHTML + '</div>' +
      '<div class="rank-name" style="color:' + color + '">' + rankStr + '</div>' +
      '<div class="rank-lp">' + (r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—') + '</div>' +
    '</div>' +
    '<div class="winrate-block">' + wrHTML + '</div>' +
    '<div class="card-actions">' +
      '<button class="refresh-btn" data-puuid="' + acc.puuid + '" title="Actualizar">↻</button>' +
      '<button class="remove-btn" data-puuid="' + acc.puuid + '" title="Eliminar">✕</button>' +
    '</div>' +
  '</div>' +
  '<div class="history-section">' +
    '<div class="card-bottom-actions">' +
      historyBtn +
      '<button class="compare-btn" data-puuid="' + acc.puuid + '" onclick="toggleCompare(\'' + acc.puuid + '\')">⚖ Comparar</button>' +
    '</div>' +
    '<div class="history-content" id="history-' + acc.puuid + '" style="display:none;">' +
      buildMatchHistoryHTML(acc.matches) +
    '</div>' +
  '</div>';
}

function renderAccounts(accounts) {
  window._accounts_ref = accounts;
  const grid = document.getElementById('accounts-grid');
  if (accounts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🗡</span><p>Sin cuentas aún</p><small>Escribe Nombre#TAG y presiona Buscar</small></div>';
    return;
  }
  grid.innerHTML = accounts.map(function(acc, idx) {
    const topRank = idx < 3 ? (idx + 1) : null;
    const cardCls = 'account-card' + (topRank ? ' top-' + topRank : '');
    var div = document.createElement('div');
    div.className = cardCls;
    div.id = 'card-' + acc.puuid;
    div.setAttribute('onclick', "openPlayerModal('" + acc.puuid + "', event)");
    var r = getRankInfo(acc);
    div.style.borderLeft = '3px solid ' + (RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED);
    div.innerHTML = buildCardHTML(acc, idx);
    return div.outerHTML;
  }).join('');
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
      <img src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${getChampImageName(c.name)}" />
      <div class="champ-tab-info">
        <span class="champ-tab-name">${escapeHTML(c.name)}</span>
        <span class="champ-tab-points">${(c.points || 0).toLocaleString()} pts</span>
      </div>
    </div>`;
  }).join('');

  const statsGrid = stats ? `
    <div class="stats-source-hint">Basado en las últimas ${stats.total} partidas</div>
    <div class="champ-stats-grid">
      <!-- Básicas y Rendimiento -->
      <div class="cstat-group-title">Rendimiento y Básicas</div>
      <div class="cstat-card">
        <div class="cstat-label">Winrate</div>
        <div class="cstat-value ${stats.winrate >= 50 ? 'text-win' : 'text-loss'}">${stats.winrate}%</div>
        <div class="cstat-sub">${stats.total} partidas</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">KDA Promedio</div>
        <div class="cstat-value">${stats.kda}</div>
        <div class="cstat-sub">${stats.kills} / ${stats.deaths} / ${stats.assists}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">CS por Minuto</div>
        <div class="cstat-value">${stats.csMin}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Visión</div>
        <div class="cstat-value">${stats.vision}</div>
      </div>

      <!-- Impacto y Objetivos -->
      <div class="cstat-group-title">Impacto y Objetivos</div>
      <div class="cstat-card">
        <div class="cstat-label">Daño / Partida</div>
        <div class="cstat-value">${stats.damage.toLocaleString()}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Daño a Torres</div>
        <div class="cstat-value">${stats.dmgTurret.toLocaleString()}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Objetivos Robados</div>
        <div class="cstat-value">${stats.objStolen}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Solo Kills</div>
        <div class="cstat-value">${stats.soloKills}</div>
      </div>

      <!-- Economía y Early -->
      <div class="cstat-group-title">Economía y Early Game</div>
      <div class="cstat-card">
        <div class="cstat-label">Oro por Minuto</div>
        <div class="cstat-value">${stats.goldMin}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Ventaja Oro @15</div>
        <div class="cstat-value ${stats.goldDiff15 >= 0 ? 'text-win' : 'text-loss'}">${stats.goldDiff15 > 0 ? '+' : ''}${stats.goldDiff15}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Ventaja CS @10</div>
        <div class="cstat-value ${stats.csDiff10 >= 0 ? 'text-win' : 'text-loss'}">${stats.csDiff10 > 0 ? '+' : ''}${stats.csDiff10}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Consumibles</div>
        <div class="cstat-value">${stats.consumables}</div>
      </div>

      <!-- Divertidas y Logros -->
      <div class="cstat-group-title">Logros y Datos de Impacto</div>
      <div class="cstat-card">
        <div class="cstat-label">Pentakills</div>
        <div class="cstat-value" style="color:#f4c874">${stats.penta}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Racha Máxima</div>
        <div class="cstat-value" style="color:#00C65E">${stats.maxWinStreak}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Primeras Sangres</div>
        <div class="cstat-value">${stats.firstBlood}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Duración Prom.</div>
        <div class="cstat-value">${stats.avgDuration} min</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Perfect Games</div>
        <div class="cstat-value" style="color:#f4c874">${stats.perfectGames}</div>
      </div>
      <div class="cstat-card">
        <div class="cstat-label">Late Wins (>35m)</div>
        <div class="cstat-value">${stats.lateWins}</div>
      </div>
    </div>
  ` : '<div class="empty-stats">Sin datos suficientes en el historial reciente</div>';

  return `
    <div class="champ-modal__box">
      <div class="champ-modal__header">
        <div class="champ-modal__title-wrap">
          <img class="champ-modal__main-img" src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${getChampImageName(champName)}" />
          <h2>${escapeHTML(champName)}</h2>
        </div>
        <button class="champ-modal__close" onclick="closeChampModal()">✕</button>
      </div>
      <div class="champ-modal__tabs">${tabsHTML}</div>
      <div class="champ-modal__body">${statsGrid}</div>
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
  if (event && (event.target.closest('button') || event.target.closest('.top-champ') || event.target.closest('.top-champ-icon'))) {
    return;
  }

  const acc = window._accounts_ref?.find(a => a.puuid === puuid);
  if (!acc) return;

  const modal = document.createElement('div');
  modal.id = 'player-modal';
  modal.className = 'player-modal';
  modal.innerHTML = buildPlayerModalHTML(acc);
  
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('player-modal--open'));

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
    setTimeout(() => modal.remove(), 300);
  }
};

function buildPlayerModalHTML(acc) {
  const stats = calculateGlobalStats(acc.matches);
  const r = getRankInfo(acc);
  const color = RANK_COLORS[r.tier] || '#fff';
  const rankText = r.tier === 'UNRANKED' ? 'UNRANKED' : `${r.tier} ${r.division} - ${r.lp} LP`;

  const statsHTML = stats ? `
    <div class="player-stats-grid">
      <div class="pstat-card">
        <div class="pstat-label">Winrate Global</div>
        <div class="pstat-value ${stats.winrate >= 50 ? 'text-win' : 'text-loss'}">${stats.winrate}%</div>
        <div class="pstat-sub">${stats.total} partidas analizadas</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">KDA Promedio</div>
        <div class="pstat-value">${stats.kda}</div>
        <div class="pstat-sub">${stats.kills} / ${stats.deaths} / ${stats.assists}</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Visión</div>
        <div class="pstat-value">${stats.vision}</div>
        <div class="pstat-sub">Puntos por partida</div>
      </div>
      <div class="pstat-card">
        <div class="pstat-label">Oro por Minuto</div>
        <div class="pstat-value">${stats.goldMin}</div>
        <div class="pstat-sub">Eficiencia de farmeo</div>
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
  ` : '<div class="empty-stats">Actualiza la cuenta para ver estadísticas detalladas</div>';

  return `
    <div class="player-modal__box">
      <div class="player-modal__header">
        <div class="player-modal__profile">
          <img class="player-modal__avatar" src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png" />
          <div class="player-modal__names">
            <h2>${escapeHTML(acc.gameName)} <span class="tag">#${escapeHTML(acc.tagLine)}</span></h2>
            <p style="color:${color}">${rankText}</p>
          </div>
        </div>
        <button class="player-modal__close" onclick="closePlayerModal()">✕</button>
      </div>
      <div class="player-modal__body">
        <div class="stats-source-hint">Resumen de desempeño en SoloQ (Últimas 20)</div>
        ${statsHTML}
      </div>
    </div>
  `;
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

  return {
    total: t,
    winrate: Math.round((s.wins / t) * 100),
    kda: ((s.k + s.a) / deaths).toFixed(2),
    kills: (s.k / t).toFixed(1),
    deaths: (s.d / t).toFixed(1),
    assists: (s.a / t).toFixed(1),
    vision: (s.vision / t).toFixed(1),
    goldMin: (s.gold / totalMin).toFixed(0),
    damage: Math.round(s.dmg / t),
    kp: Math.round(s.kp / t)
  };
}