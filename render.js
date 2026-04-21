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

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCardHTML(acc) {
  const soloQ = acc.soloQ || { tier: 'UNRANKED', rank: '', leaguePoints: 0 };
  const iconId = acc.profileIconId || 29;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${iconId}.png`;

  return `
    <div class="card-content-wrapper">
      <div class="card-top">
        <div class="icon-wrap">
          <img src="${iconUrl}" alt="Icono" />
          <span class="icon-level">${acc.summonerLevel}</span>
        </div>
        <div class="summoner-info">
          <div class="summoner-name">${escapeHTML(acc.gameName)}</div>
          <div class="summoner-tag">#${escapeHTML(acc.tagLine)}</div>
        </div>
        <div class="rank-block">
          <div class="rank-name" style="color:${RANK_COLORS[soloQ.tier]}">
            ${soloQ.tier} ${soloQ.rank}
          </div>
          <div class="rank-lp">${soloQ.leaguePoints} LP</div>
        </div>
        <div class="card-actions">
          <button class="refresh-btn" data-puuid="${acc.puuid}">↻</button>
          <button class="remove-btn" data-puuid="${acc.puuid}">✕</button>
        </div>
      </div>
    </div>`;
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');
  if (!grid) return;
  
  if (accounts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Sin cuentas aún</p></div>';
    return;
  }

  grid.innerHTML = ''; 

  accounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'account-card';
    div.id = 'card-' + acc.puuid;
    div.innerHTML = buildCardHTML(acc);
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