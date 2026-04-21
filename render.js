/**
 * render.js — DOM rendering helpers for LAN Tracker
 */

const RANK_COLORS = {
  IRON:        '#6B5A4E',
  BRONZE:      '#CD7F32',
  SILVER:      '#A8A9AD',
  GOLD:        '#C89B3C',
  PLATINUM:    '#00B4B0',
  EMERALD:     '#00C65E',
  DIAMOND:     '#578ACA',
  MASTER:      '#9D4DC7',
  GRANDMASTER: '#CF4FC9',
  CHALLENGER:  '#F4C874',
  UNRANKED:    '#3D5068',
};

const RANK_EMOJI = {
  IRON:        '⬛',
  BRONZE:      '🟫',
  SILVER:      '⬜',
  GOLD:        '🟨',
  PLATINUM:    '🟦',
  EMERALD:     '🟩',
  DIAMOND:     '💎',
  MASTER:      '🔮',
  GRANDMASTER: '👑',
  CHALLENGER:  '✨',
  UNRANKED:    '❓',
};

function getRankInfo(acc) {
  const soloQ = acc.soloQ;
  if (!soloQ) return { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0 };
  return {
    tier:     soloQ.tier,
    division: soloQ.rank,
    lp:        soloQ.leaguePoints,
    wins:      soloQ.wins,
    losses:    soloQ.losses,
  };
}

function computeWinrate(wins, losses) {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
}

function winrateClass(wr) {
  if (wr === null) return 'empty';
  if (wr >= 55)   return 'good';
  if (wr >= 48)   return 'ok';
  return 'bad';
}

function titleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function buildStreakHTML(streak) {
  if (!streak || streak === 0) return '';
  const isWin  = streak > 0;
  const count  = Math.abs(streak);
  const cls    = isWin ? 'streak-win' : 'streak-loss';
  const label  = isWin ? count + 'V seguidas' : count + 'D seguidas';
  return '<span class="streak-badge ' + cls + '">' + label + '</span>';
}

function buildMatchHistoryHTML(matches) {
  if (!matches || matches.length === 0) return '';

  const items = matches.map(function(m) {
    const cls = m.win ? 'match-win' : 'match-loss';
    const kda = m.kills + '/' + m.deaths + '/' + m.assists;
    const dur = formatDuration(m.gameDuration);
    const img = 'https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/' + m.champion + '.png';
    return '<div class="match-item ' + cls + '">' +
      '<img class="match-champ" src="' + img + '" alt="' + escapeHTML(m.champion) + '" onerror="this.style.display=\'none\'" />' +
      '<div class="match-result-dot ' + (m.win ? 'dot-win' : 'dot-loss') + '"></div>' +
      '<div class="match-info-box">' +
        '<span class="match-champ-name">' + escapeHTML(m.champion) + '</span>' +
        '<span class="match-kda">' + kda + '</span>' +
        '<span class="match-dur">' + dur + '</span>' +
      '</div>' +
    '</div>';
  });

  return '<div class="match-history hidden-history">' + items.join('') + '</div>';
}

function buildCardHTML(acc) {
  const r       = getRankInfo(acc);
  const wr      = computeWinrate(r.wins, r.losses);
  const wrCls   = winrateClass(wr);
  const color   = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
  const emoji   = RANK_EMOJI[r.tier]  || '❓';
  const rankStr = r.tier === 'UNRANKED'
    ? 'Sin clasificar'
    : titleCase(r.tier) + ' ' + r.division;

  const iconUrl = typeof getProfileIconUrl === 'function' ? getProfileIconUrl(acc.profileIconId) : '';

  const wrHTML = wr !== null
    ? '<div class="wr-number ' + wrCls + '">' + wr + '%</div><div class="wr-label">Winrate</div><div class="wr-games">' + r.wins + 'V ' + r.losses + 'D</div>'
    : '<div class="wr-number empty">—</div><div class="wr-label">Sin partidas</div>';

  const updatedStr = acc.updatedAt
    ? 'Act: ' + new Date(acc.updatedAt).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})
    : '';

  const position = acc.mainPosition || '—';
  const streak   = buildStreakHTML(acc.streak);

  return '<div class="card-content-wrapper">' + 
    '<div class="card-top">' +
      '<div class="icon-wrap">' +
        '<img src="' + iconUrl + '" alt="Icono" />' +
        '<span class="icon-level">' + acc.summonerLevel + '</span>' +
      '</div>' +
      '<div class="summoner-info">' +
        '<div class="summoner-name">' + escapeHTML(acc.gameName) + '</div>' +
        '<div class="summoner-tag">#' + escapeHTML(acc.tagLine) + '</div>' +
        '<div class="summoner-meta">' +
          '<span class="summoner-region">LAN</span>' +
          '<span class="position-badge">' + escapeHTML(position) + '</span>' +
          streak +
          (updatedStr ? '<span class="updated-time">' + updatedStr + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="rank-block">' +
        '<div class="rank-emblem">' + emoji + '</div>' +
        '<div class="rank-name" style="color:' + color + '">' + rankStr + '</div>' +
        '<div class="rank-lp">' + (r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—') + '</div>' +
      '</div>' +
      '<div class="winrate-block">' + wrHTML + '</div>' +
      '<div class="card-actions">' +
        '<button class="refresh-btn" data-puuid="' + acc.puuid + '" title="Actualizar">↻</button>' +
        '<button class="remove-btn" data-puuid="' + acc.puuid + '" title="Eliminar">✕</button>' +
      '</div>' +
    '</div>' +
    buildMatchHistoryHTML(acc.matches) +
  '</div>';
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');
  if (!grid) return;
  
  if (accounts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🗡</span><p>Sin cuentas aun</p><small>Escribe Nombre#TAG y presiona Buscar</small></div>';
    return;
  }

  grid.innerHTML = ''; 

  accounts.forEach(function(acc) {
    const div = document.createElement('div');
    div.className = 'account-card';
    div.id = 'card-' + acc.puuid;
    div.innerHTML = buildCardHTML(acc);

    div.addEventListener('click', function(e) {
      if (e.target.closest('button')) return;
      const historySection = div.querySelector('.match-history');
      if (historySection) {
        historySection.classList.toggle('active-history');
      }
    });

    grid.appendChild(div);
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }
}

function getApiErrorMessage(status) {
  switch (status) {
    case 400: return 'Solicitud invalida. Revisa el formato Nombre#TAG.';
    case 403: return 'API key invalida o expirada.';
    case 404: return 'Cuenta no encontrada en LAN.';
    case 429: return 'Demasiadas solicitudes. Espera un momento.';
    case 503: return 'El servidor de Riot esta caido.';
    default:  return 'Error inesperado (HTTP ' + status + ').';
  }
}