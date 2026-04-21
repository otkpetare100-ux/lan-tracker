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

const DDRAGON_VERSION = '14.10.1';

function getRankInfo(acc) {
  const soloQ = acc.soloQ;
  if (!soloQ) return { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0 };
  return {
    tier:     soloQ.tier,
    division: soloQ.rank,
    lp:       soloQ.leaguePoints,
    wins:     soloQ.wins,
    losses:   soloQ.losses,
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

function formatPoints(pts) {
  if (pts >= 1000000) return (pts / 1000000).toFixed(1) + 'M';
  if (pts >= 1000)    return Math.round(pts / 1000) + 'K';
  return pts;
}

function buildChampionsHTML(topChampions) {
  if (!topChampions || topChampions.length === 0) return '';
  return `
    <div class="champs-block">
      ${topChampions.map(c => `
        <div class="champ-item" title="${escapeHTML(c.name)} — ${formatPoints(c.championPoints)} pts">
          <img
            src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${escapeHTML(c.image)}"
            alt="${escapeHTML(c.name)}"
            onerror="this.style.display='none'"
          />
          <span class="champ-name">${escapeHTML(c.name)}</span>
          <span class="champ-pts">${formatPoints(c.championPoints)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function buildCardHTML(acc, isRefreshing = false) {
  const r       = getRankInfo(acc);
  const wr      = computeWinrate(r.wins, r.losses);
  const wrCls   = winrateClass(wr);
  const color   = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
  const emoji   = RANK_EMOJI[r.tier]  || '❓';
  const rankStr = r.tier === 'UNRANKED'
    ? 'Sin clasificar'
    : `${titleCase(r.tier)} ${r.division}`;

  const iconUrl = getProfileIconUrl(acc.profileIconId);

  const wrHTML = wr !== null
    ? `<div class="wr-number ${wrCls}">${wr}%</div>
       <div class="wr-label">Winrate</div>
       <div class="wr-games">${r.wins}V ${r.losses}D</div>`
    : `<div class="wr-number empty">—</div>
       <div class="wr-label">Sin partidas</div>`;

  const updatedStr = acc.updatedAt
    ? `Actualizado: ${new Date(acc.updatedAt).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}`
    : '';

  return `
    <div class="card-top">
      <div class="icon-wrap">
        <img src="${iconUrl}" alt="Icono" onerror="this.src='${FALLBACK_ICON_URL}'" />
        <span class="icon-level">${acc.summonerLevel}</span>
      </div>

      <div class="summoner-info">
        <div class="summoner-name">${escapeHTML(acc.gameName)}</div>
        <div class="summoner-tag">#${escapeHTML(acc.tagLine)}</div>
        <div class="summoner-meta">
          <span class="summoner-region">LAN</span>
          ${updatedStr ? `<span class="updated-time">${updatedStr}</span>` : ''}
        </div>
      </div>

      <div class="rank-block">
        <div class="rank-emblem">${emoji}</div>
        <div class="rank-name" style="color:${color}">${rankStr}</div>
        <div class="rank-lp">${r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—'}</div>
      </div>

      <div class="winrate-block">
        ${wrHTML}
      </div>

      <div class="card-actions">
        <button class="refresh-btn ${isRefreshing ? 'spinning' : ''}" data-puuid="${acc.puuid}" title="Actualizar" ${isRefreshing ? 'disabled' : ''}>↻</button>
        <button class="remove-btn" data-puuid="${acc.puuid}" title="Eliminar">✕</button>
      </div>
    </div>

    ${buildChampionsHTML(acc.topChampions)}
  `;
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');

  if (accounts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🗡</span>
        <p>Sin cuentas aun</p>
        <small>Escribe Nombre#TAG y presiona Buscar</small>
      </div>`;
    return;
  }

  grid.innerHTML = accounts.map(acc => {
    const div = document.createElement('div');
    div.className = 'account-card';
    div.id = `card-${acc.puuid}`;
    div.innerHTML = buildCardHTML(acc);
    return div.outerHTML;
  }).join('');
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function getApiErrorMessage(status) {
  switch (status) {
    case 400: return 'Solicitud invalida. Revisa el formato Nombre#TAG.';
    case 403: return 'API key invalida o expirada. Renovela en developer.riotgames.com';
    case 404: return 'Cuenta no encontrada en LAN. Verifica el nombre y tag.';
    case 429: return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    case 503: return 'El servidor de Riot esta caido. Intenta mas tarde.';
    default:  return `Error inesperado (HTTP ${status}). Intenta de nuevo.`;
  }
}
