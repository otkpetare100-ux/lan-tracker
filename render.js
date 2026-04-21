/**
 * render.js — DOM rendering helpers for LAN Tracker
 */

// 1. CONFIGURACIÓN ÚNICA (Sin duplicados)
const DDragonVersion = '14.8.1'; 
const FALLBACK_ICON_URL = 'https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/29.png'; 

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

// 2. FUNCIONES DE APOYO
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
  return total === 0 ? null : Math.round((wins / total) * 100);
}

function winrateClass(wr) {
  if (wr === null) return 'empty';
  if (wr >= 55)   return 'good';
  if (wr >= 48)   return 'ok';
  return 'bad';
}

function titleCase(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function buildStreakHTML(streak) {
  if (!streak || streak === 0) return '';
  const isWin = streak > 0;
  const count = Math.abs(streak);
  const cls = isWin ? 'streak-win' : 'streak-loss';
  return `<span class="streak-badge ${cls}">${count}${isWin ? 'V' : 'D'} seguidas</span>`;
}

function buildMatchHistoryHTML(matches) {
  if (!matches || matches.length === 0) return '';
  const items = matches.map(m => {
    const cls = m.win ? 'match-win' : 'match-loss';
    const img = `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/champion/${m.champion}.png`;
    return `
      <div class="match-item ${cls}">
        <img class="match-champ" src="${img}" alt="${escapeHTML(m.champion)}" onerror="this.style.display='none'" />
        <div class="match-result-dot ${m.win ? 'dot-win' : 'dot-loss'}"></div>
        <div class="match-info-box">
          <span class="match-kda">${m.kills}/${m.deaths}/${m.assists}</span>
          <span class="match-dur">${formatDuration(m.gameDuration)}</span>
        </div>
      </div>`;
  });
  return `<div class="match-history">${items.join('')}</div>`;
}

// 3. RENDERIZADO PRINCIPAL
function buildCardHTML(acc) {
  const r = getRankInfo(acc);
  const wr = computeWinrate(r.wins, r.losses);
  const color = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
  const iconId = acc.profileIconId || 29;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/profileicon/${iconId}.png`;

  return `
    <div class="card-content-wrapper">
      <div class="card-top">
        <div class="icon-wrap">
          <img src="${iconUrl}" alt="Icono" onerror="this.src='${FALLBACK_ICON_URL}'; this.onerror=null;" />
          <span class="icon-level">${acc.summonerLevel}</span>
        </div>
        <div class="summoner-info">
          <div class="summoner-name">${escapeHTML(acc.gameName)}</div>
          <div class="summoner-tag">#${escapeHTML(acc.tagLine)}</div>
          <div class="summoner-meta">
            <span class="position-badge">${escapeHTML(acc.mainPosition || '—')}</span>
            ${buildStreakHTML(acc.streak)}
          </div>
        </div>
        <div class="rank-block">
          <div class="rank-emblem">${RANK_EMOJI[r.tier] || '❓'}</div>
          <div class="rank-name" style="color:${color}">${r.tier === 'UNRANKED' ? 'Sin Rango' : titleCase(r.tier)}</div>
          <div class="rank-lp">${r.lp} LP</div>
        </div>
        <div class="winrate-block">
          <div class="wr-number ${winrateClass(wr)}">${wr ? wr + '%' : '—'}</div>
          <div class="wr-label">Winrate</div>
        </div>
        <div class="card-actions">
          <button class="refresh-btn" data-puuid="${acc.puuid}">↻</button>
          <button class="remove-btn" data-puuid="${acc.puuid}">✕</button>
        </div>
      </div>
      ${buildMatchHistoryHTML(acc.matches)}
    </div>`;
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');
  if (!grid) return;
  grid.innerHTML = accounts.length === 0 
    ? '<div class="empty-state"><p>Sin cuentas aún</p></div>' 
    : '';

  accounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'account-card';
    div.id = 'card-' + acc.puuid;
    div.innerHTML = buildCardHTML(acc);
    div.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const history = div.querySelector('.match-history');
      if (history) history.classList.toggle('active-history');
    });
    grid.appendChild(div);
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}