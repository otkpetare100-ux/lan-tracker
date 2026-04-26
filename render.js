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
  UNRANKED:    null,
};

const MEDALS = {
  0: '/pic/medalla top/top1.png',
  1: '/pic/medalla top/top2.png',
  2: '/pic/medalla top/top3.png',
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

function buildTopChampsHTML(topChampions) {
  if (!topChampions || topChampions.length === 0) return '';
  return topChampions.map(function(c) {
    if (!c.name) return '';
    var img = 'https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/' + getChampImageName(c.name);
    return '<div class="top-champ" title="' + escapeHTML(c.name) + '">' +
      '<img src="' + img + '" alt="' + escapeHTML(c.name) + '" onerror="this.style.display=\'none\'" />' +
    '</div>';
  }).join('');
}

function buildCardHTML(acc, position) {
  const r       = getRankInfo(acc);
  const wr      = computeWinrate(r.wins, r.losses);
  const wrCls   = winrateClass(wr);
  const color   = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
  const rankStr = r.tier === 'UNRANKED' ? 'Sin clasificar' : titleCase(r.tier) + ' ' + r.division;
  const iconUrl = getProfileIconUrl(acc.profileIconId);

  const updatedStr = acc.updatedAt
    ? 'Act: ' + new Date(acc.updatedAt).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})
    : '';
  const posLabel = acc.mainPosition || '—';
  const streak   = buildStreakHTML(acc.streak);

  const wrHTML = wr !== null
    ? '<div class="wr-number ' + wrCls + '">' + wr + '%</div><div class="wr-label">Winrate</div><div class="wr-games">' + r.wins + 'V ' + r.losses + 'D</div>'
    : '<div class="wr-number empty">—</div><div class="wr-label">Sin partidas</div>';

  const medalHTML = '';
    ? '<img src="' + MEDALS[position] + '" class="medal-badge-img" alt="top' + (position+1) + '">'
    : '';

  const frameHTML = '<img src="/pic/frame/' + r.tier.toLowerCase() + '-frame.png" class="rank-frame" onerror="this.remove()">';

  const rankIconHTML = RANK_ICONS[r.tier]
    ? '<img src="' + RANK_ICONS[r.tier] + '" alt="' + r.tier + '" class="rank-icon" />'
    : '❓';

  const historyBtn = '<button class="history-toggle-btn" data-puuid="' + acc.puuid + '">' +
    '<span class="history-btn-text">Ver historial</span><span class="history-arrow">▾</span>' +
  '</button>';

  return '<div class="card-top">' +
    '<div class="icon-wrap">' +
      frameHTML +
      medalHTML +
      '<img class="profile-main-icon" src="' + iconUrl + '" alt="Icono" onerror="this.src=\'' + FALLBACK_ICON_URL + '\'" />' +
      '<span class="icon-level">' + acc.summonerLevel + '</span>' +
    '</div>' +
    '<div class="summoner-info">' +
      '<div class="summoner-name">' + escapeHTML(acc.gameName) + '</div>' +
      '<div class="summoner-tag">#' + escapeHTML(acc.tagLine) + '</div>' +
      '<div class="summoner-meta">' +
        '<span class="summoner-region">LAN</span>' +
        '<span class="position-badge">' + escapeHTML(posLabel) + '</span>' +
        streak +
        (updatedStr ? '<span class="updated-time">' + updatedStr + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="top-champs-block"><div class="top-champs-inner">' + buildTopChampsHTML(acc.topChampions) + '</div></div>' +
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
    '<div class="compare-btn-wrap">' +
      '<button class="compare-btn" data-puuid="' + acc.puuid + '" onclick="toggleCompare(\'' + acc.puuid + '\')">⚖ Comparar</button>' +
    '</div>' +
  '</div>' +
  '<div class="history-section">' +
    historyBtn +
    '<div class="history-content" id="history-' + acc.puuid + '" style="display:none;">' +
      buildMatchHistoryHTML(acc.matches) +
    '</div>' +
  '</div>';
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');
  if (accounts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🗡</span><p>Sin cuentas aun</p><small>Escribe Nombre#TAG y presiona Buscar</small></div>';
    return;
  }
  grid.innerHTML = accounts.map(function(acc, idx) {
    var div = document.createElement('div');
    div.className = 'account-card' + (idx < 3 ? ' top-' + (idx + 1) : '');
    div.id = 'card-' + acc.puuid;
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
    case 400: return 'Solicitud invalida. Revisa el formato Nombre#TAG.';
    case 403: return 'API key invalida o expirada. Renovela en developer.riotgames.com';
    case 404: return 'Cuenta no encontrada en LAN. Verifica el nombre y tag.';
    case 429: return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    case 503: return 'El servidor de Riot esta caido. Intenta mas tarde.';
    default:  return 'Error inesperado (HTTP ' + status + '). Intenta de nuevo.';
  }
}