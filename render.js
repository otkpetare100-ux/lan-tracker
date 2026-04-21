/**
 * render.js — DOM rendering helpers for LAN Tracker
 *
 * Pure functions: given data → return HTML strings or update the DOM.
 * No direct API calls or storage operations here.
 */

/* ---- Rank metadata ---- */

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

/* ---- Helpers ---- */

/**
 * Extracts Solo/Duo ranked info from a stored entry.
 * @param {AccountEntry} acc
 */
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

/**
 * Computes winrate as a percentage integer, or null if no games played.
 * @param {number} wins
 * @param {number} losses
 * @returns {number|null}
 */
function computeWinrate(wins, losses) {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
}

/**
 * Returns a CSS class name based on winrate value.
 * @param {number|null} wr
 */
function winrateClass(wr) {
  if (wr === null) return 'empty';
  if (wr >= 55)   return 'good';
  if (wr >= 48)   return 'ok';
  return 'bad';
}

/**
 * Capitalises only the first letter of a string.
 * e.g. "PLATINUM" → "Platinum"
 */
function titleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/* ---- Card HTML builder ---- */

/**
 * Builds the inner HTML for a single account card.
 * @param {AccountEntry} acc
 * @returns {string} HTML string
 */
function buildCardHTML(acc) {
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
       <div class="wr-games">${r.wins}V  ${r.losses}D</div>`
    : `<div class="wr-number empty">—</div>
       <div class="wr-label">Sin partidas</div>`;

  return `
    <div class="icon-wrap">
      <img
        src="${iconUrl}"
        alt="Ícono de invocador"
        onerror="this.src='${FALLBACK_ICON_URL}'"
      />
      <span class="icon-level">${acc.summonerLevel}</span>
    </div>

    <div class="summoner-info">
      <div class="summoner-name">${escapeHTML(acc.gameName)}</div>
      <div class="summoner-tag">#${escapeHTML(acc.tagLine)}</div>
      <span class="summoner-region">LAN</span>
    </div>

    <div class="rank-block">
      <div class="rank-emblem">${emoji}</div>
      <div class="rank-name" style="color:${color}">${rankStr}</div>
      <div class="rank-lp">${r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—'}</div>
    </div>

    <div class="winrate-block">
      ${wrHTML}
    </div>

    <button
      class="remove-btn"
      data-puuid="${acc.puuid}"
      title="Eliminar cuenta"
      aria-label="Eliminar ${acc.gameName}"
    >✕</button>
  `;
}

/**
 * Basic HTML escaping to prevent XSS from summoner names.
 * @param {string} str
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- DOM update functions ---- */

/**
 * Re-renders the entire accounts grid.
 * @param {AccountEntry[]} accounts
 */
function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');

  if (accounts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🗡</span>
        <p>Sin cuentas aún</p>
        <small>Escribe Nombre#TAG y presiona Buscar</small>
      </div>`;
    return;
  }

  grid.innerHTML = accounts
    .map(acc => {
      const div = document.createElement('div');
      div.className = 'account-card';
      div.id = `card-${acc.puuid}`;
      div.innerHTML = buildCardHTML(acc);
      return div.outerHTML;
    })
    .join('');
}

/**
 * Shows or hides the error message element.
 * @param {string} msg  Empty string to hide.
 */
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

/**
 * Translates a Riot API HTTP status code into a user-friendly message.
 * @param {number} status
 * @returns {string}
 */
function getApiErrorMessage(status) {
  switch (status) {
    case 400: return 'Solicitud inválida. Revisa el formato Nombre#TAG.';
    case 403: return 'API key inválida o expirada. Renuévala en developer.riotgames.com';
    case 404: return 'Cuenta no encontrada en LAN. Verifica el nombre y tag.';
    case 429: return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    case 503: return 'El servidor de Riot está caído. Intenta más tarde.';
    default:  return `Error inesperado (HTTP ${status}). Intenta de nuevo.`;
  }
}
