/**
 * render.js — DOM rendering helpers for LAN Tracker
 */

(function () {
  if (window.__LAN_TRACKER_RENDER_LOADED__) return;
  window.__LAN_TRACKER_RENDER_LOADED__ = true;

  function getProfileIconUrl(iconId) {
    return `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${iconId}.png`;
  }

  const FALLBACK_ICON_URL = 'https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/29.png';

  const RANK_COLORS = {
    IRON: '#6B5A4E', BRONZE: '#CD7F32', SILVER: '#A8A9AD', GOLD: '#C89B3C',
    PLATINUM: '#00B4B0', EMERALD: '#00C65E', DIAMOND: '#578ACA',
    MASTER: '#9D4DC7', GRANDMASTER: '#CF4FC9', CHALLENGER: '#F4C874', UNRANKED: '#3D5068',
  };

  const RANK_ICONS = {
    UNRANKED: '/ranks/unranked.png', IRON: '/ranks/iron.png', BRONZE: '/ranks/bronze.png',
    SILVER: '/ranks/silver.png', GOLD: '/ranks/gold.png', PLATINUM: '/ranks/platinum.png',
    EMERALD: '/ranks/emerald.png', DIAMOND: '/ranks/diamond.png', MASTER: '/ranks/master.png',
    GRANDMASTER: '/ranks/grandmaster.png', CHALLENGER: '/ranks/challenger.png',
  };

  const MEDALS = { 0: '🥇', 1: '🥈', 2: '🥉' };

  const CHAMP_NAME_FIX = {
    'AurelionSol': 'AurelionSol', 'Belveth': 'Belveth', 'Chogath': 'Chogath',
    'DrMundo': 'DrMundo', 'JarvanIV': 'JarvanIV', 'Kaisa': 'Kaisa',
    'Khazix': 'Khazix', 'KogMaw': 'KogMaw', 'KSante': 'KSante',
    'Leblanc': 'Leblanc', 'LeeSin': 'LeeSin', 'MasterYi': 'MasterYi',
    'MissFortune': 'MissFortune', 'MonkeyKing': 'MonkeyKing', 'Wukong': 'MonkeyKing',
    'Nunu': 'Nunu', 'NunuWillump': 'Nunu', 'RekSai': 'RekSai',
    'TahmKench': 'TahmKench', 'TwistedFate': 'TwistedFate', 'Velkoz': 'Velkoz',
    'XinZhao': 'XinZhao', 'Fiddlesticks': 'Fiddlesticks', 'Renata': 'Renata',
    'RenataGlasc': 'Renata', 'Mel': 'Mel',
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

  function titleCase(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''; }

  function escapeHTML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function getChampImageName(name) {
    if (!name) return 'Unknown.png';
    let base = name.replace(/\.png$/i, '');
    let clean = base.replace(/[^a-zA-Z0-9]/g, '');
    return (CHAMP_NAME_FIX[clean] || CHAMP_NAME_FIX[base] || clean) + '.png';
  }

  function buildStreakHTML(streak) {
    if (!streak || streak === 0) return '';
    const isWin = streak > 0;
    const cls = isWin ? 'streak-win' : 'streak-loss';
    const label = isWin ? Math.abs(streak) + 'V' : Math.abs(streak) + 'D';
    return `<span class="streak-badge ${cls}">${label}</span>`;
  }

  function buildMatchHistoryHTML(matches) {
    if (!matches || matches.length === 0) return '<div class="match-empty">Sin partidas recientes</div>';
    return '<div class="match-history">' + matches.map(m => {
      const cls = m.win ? 'match-win' : 'match-loss';
      const img = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${getChampImageName(m.champion)}`;
      return `
        <div class="match-item ${cls}">
          <img class="match-champ" src="${img}" onerror="this.src='${FALLBACK_ICON_URL}'">
          <div class="dot-${m.win ? 'win' : 'loss'}"></div>
          <span class="match-kda">${m.kills}/${m.deaths}/${m.assists}</span>
        </div>`;
    }).join('') + '</div>';
  }

  function buildTopChampsHTML(topChampions) {
    if (!topChampions || topChampions.length === 0) return '';
    return topChampions.map(c => {
      const img = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${getChampImageName(c.name)}`;
      return `<div class="top-champ"><img src="${img}" title="${c.name}"></div>`;
    }).join('');
  }

  function buildCardHTML(acc, position) {
    const r = getRankInfo(acc);
    const wr = computeWinrate(r.wins, r.losses);
    const color = RANK_COLORS[r.tier] || RANK_COLORS.UNRANKED;
    const rankStr = r.tier === 'UNRANKED' ? 'Sin Clasificar' : `${titleCase(r.tier)} ${r.division}`;

    let frameHTML = '';
    if (position < 3) {
      frameHTML = `<img src="/pic/${r.tier.toLowerCase()}-frame.png" class="rank-frame" onerror="this.remove()">`;
    }

    return `
      <div class="card-top">
        <div class="icon-wrap">
          ${frameHTML}
          ${MEDALS[position] ? `<div class="medal-badge">${MEDALS[position]}</div>` : ''}
          <img class="profile-main-icon" src="${getProfileIconUrl(acc.profileIconId)}" onerror="this.src='${FALLBACK_ICON_URL}'">
          <div class="icon-level">${acc.summonerLevel}</div>
        </div>

        <div class="summoner-info">
          <div class="summoner-name">${escapeHTML(acc.gameName)}</div>
          <div class="summoner-tag">#${escapeHTML(acc.tagLine)}</div>
          <div class="summoner-meta">
            <span class="position-badge">${acc.mainPosition || '—'}</span>
            ${buildStreakHTML(acc.streak)}
          </div>
        </div>

        <div class="top-champs-block"><div class="top-champs-inner">${buildTopChampsHTML(acc.topChampions)}</div></div>

        <div class="rank-block">
          <div class="rank-emblem">
            ${RANK_ICONS[r.tier] ? `<img src="${RANK_ICONS[r.tier]}" class="rank-icon">` : '❓'}
          </div>
          <div class="rank-name" style="color:${color}">${rankStr}</div>
          <div class="rank-lp">${r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—'}</div>
        </div>

        <div class="winrate-block">
          <div class="wr-number ${winrateClass(wr)}">${wr !== null ? wr + '%' : '—'}</div>
          <div class="wr-label">${wr !== null ? 'Winrate' : 'Sin datos'}</div>
        </div>

        <div class="card-actions">
          <button class="refresh-btn" data-puuid="${acc.puuid}">↻</button>
          <button class="remove-btn" data-puuid="${acc.puuid}">✕</button>
        </div>
      </div>

      <div class="history-section">
        <button class="history-toggle-btn" data-puuid="${acc.puuid}">
          <span class="history-btn-text">Ver historial</span> <span class="history-arrow">▾</span>
        </button>
        <div class="history-content" id="history-${acc.puuid}" style="display:none;">
          ${buildMatchHistoryHTML(acc.matches)}
        </div>
      </div>
    `;
  }

  function renderAccounts(accounts) {
    const grid = document.getElementById('accounts-grid');
    if (!grid) return;

    if (!accounts || accounts.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>No hay cuentas en la lista.</p></div>';
      return;
    }

    grid.innerHTML = accounts.map((acc, idx) => {
      const topCls = idx < 3 ? ` top-${idx + 1}` : '';
      return `<div class="account-card${topCls}" id="card-${acc.puuid}">${buildCardHTML(acc, idx)}</div>`;
    }).join('');
  }

  function showError(msg) {
    const el = document.getElementById('error-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    if (msg) setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function getApiErrorMessage(status) {
    const errors = { 404: "No encontrado", 429: "Límite de Riot alcanzado", 403: "API Key vencida" };
    return errors[status] || "Error de conexión";
  }

  window.getProfileIconUrl = getProfileIconUrl;
  window.FALLBACK_ICON_URL = FALLBACK_ICON_URL;
  window.RANK_COLORS = RANK_COLORS;
  window.RANK_ICONS = RANK_ICONS;
  window.MEDALS = MEDALS;
  window.CHAMP_NAME_FIX = CHAMP_NAME_FIX;
  window.getRankInfo = getRankInfo;
  window.computeWinrate = computeWinrate;
  window.winrateClass = winrateClass;
  window.titleCase = titleCase;
  window.escapeHTML = escapeHTML;
  window.formatDuration = formatDuration;
  window.getChampImageName = getChampImageName;
  window.buildStreakHTML = buildStreakHTML;
  window.buildMatchHistoryHTML = buildMatchHistoryHTML;
  window.buildTopChampsHTML = buildTopChampsHTML;
  window.buildCardHTML = buildCardHTML;
  window.renderAccounts = renderAccounts;
  window.showError = showError;
  window.getApiErrorMessage = getApiErrorMessage;
})();