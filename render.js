/**
 * render.js — LAN Tracker: Versión con Rachas y Fix de Iconos
 */

const DDragonVersion = '14.8.1';
const FALLBACK_ICON = 'https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/29.png';

const RANK_COLORS = {
  IRON: '#6B5A4E', BRONZE: '#CD7F32', SILVER: '#A8A9AD', GOLD: '#C89B3C',
  PLATINUM: '#00B4B0', EMERALD: '#00C65E', DIAMOND: '#578ACA', MASTER: '#9D4DC7',
  GRANDMASTER: '#CF4FC9', CHALLENGER: '#F4C874', UNRANKED: '#3D5068'
};

// 1. Nueva función para generar la etiqueta de racha
function getStreakBadge(streak) {
  if (!streak || streak === 0) return '';
  const isWin = streak > 0;
  const cls = isWin ? 'streak-win' : 'streak-loss'; // Asegúrate de tener estos estilos en tu CSS
  const label = isWin ? 'V' : 'D';
  return `<span class="streak-badge ${cls}" style="background:${isWin ? '#28a745' : '#dc3545'}; color:white; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:8px; font-weight:bold;">${Math.abs(streak)}${label}</span>`;
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCardHTML(acc) {
  const soloQ = acc.soloQ || { tier: 'UNRANKED', rank: '', leaguePoints: 0 };
  const iconId = acc.profileIconId || 29;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/profileicon/${iconId}.png`;

  return `
    <div class="card-content-wrapper" style="display:flex; align-items:center; padding:15px; gap:15px;">
      <div class="icon-wrap" style="position:relative;">
        <img src="${iconUrl}" onerror="this.src='${FALLBACK_ICON}'; this.onerror=null;" width="54" style="border-radius:50%; border: 2px solid #c89b3c;">
        <span class="icon-level" style="position:absolute; bottom:-5px; left:50%; transform:translateX(-50%); background:#010a13; color:#f0e6d2; font-size:10px; padding:0 5px; border:1px solid #c89b3c; border-radius:10px;">${acc.summonerLevel}</span>
      </div>
      
      <div class="summoner-info" style="flex-grow:1;">
        <div style="display:flex; align-items:center;">
          <strong class="summoner-name" style="font-size:16px; color:#f0e6d2;">${escapeHTML(acc.gameName)}</strong>
          ${getStreakBadge(acc.streak)}
        </div>
        <div class="summoner-tag" style="color:#a09b8c; font-size:12px;">#${escapeHTML(acc.tagLine)}</div>
      </div>

      <div class="rank-block" style="text-align:right; min-width:100px;">
        <div class="rank-name" style="color:${RANK_COLORS[soloQ.tier]}; font-weight:bold; font-size:13px; text-transform:uppercase;">
          ${soloQ.tier} ${soloQ.rank}
        </div>
        <div class="rank-lp" style="color:#cdbe91; font-size:12px;">${soloQ.leaguePoints} LP</div>
      </div>

      <div class="card-actions">
        <button class="refresh-btn" data-puuid="${acc.puuid}" style="background:transparent; border:1px solid #5b5a56; color:#a09b8c; cursor:pointer; padding:5px 8px; border-radius:4px; margin-right:5px;">↻</button>
        <button class="remove-btn" data-puuid="${acc.puuid}" style="background:transparent; border:1px solid #5b5a56; color:#a09b8c; cursor:pointer; padding:5px 8px; border-radius:4px;">✕</button>
      </div>
    </div>`;
}

function renderAccounts(accounts) {
  const grid = document.getElementById('accounts-grid');
  if (!grid) return;
  grid.innerHTML = accounts.length === 0 ? '<div class="empty-state">Sin cuentas aún</div>' : '';

  accounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'account-card';
    div.style.background = 'rgba(30, 35, 40, 0.9)';
    div.style.border = '1px solid #3c3c41';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '10px';
    div.innerHTML = buildCardHTML(acc);
    grid.appendChild(div);
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}