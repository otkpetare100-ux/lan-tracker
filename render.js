/**
 * render.js — LAN Tracker (Versión de Emergencia con var)
 */

// Usamos var para evitar el error de "Already Declared" si el script se carga doble
var DDragonVersion = '14.8.1'; 
var FALLBACK_ICON_URL = 'https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/29.png'; 

var RANK_COLORS = {
  IRON: '#6B5A4E', BRONZE: '#CD7F32', SILVER: '#A8A9AD', GOLD: '#C89B3C',
  PLATINUM: '#00B4B0', EMERALD: '#00C65E', DIAMOND: '#578ACA', MASTER: '#9D4DC7',
  GRANDMASTER: '#CF4FC9', CHALLENGER: '#F4C874', UNRANKED: '#3D5068'
};

var RANK_EMOJI = {
  IRON: '⬛', BRONZE: '🟫', SILVER: '⬜', GOLD: '🟨', PLATINUM: '🟦',
  EMERALD: '🟩', DIAMOND: '💎', MASTER: '🔮', GRANDMASTER: '👑',
  CHALLENGER: '✨', UNRANKED: '❓'
};

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDuration(seconds) {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function buildMatchHistoryHTML(matches) {
  if (!matches || matches.length === 0) return '';
  var items = matches.map(function(m) {
    var cls = m.win ? 'match-win' : 'match-loss';
    var img = 'https://ddragon.leagueoflegends.com/cdn/' + DDragonVersion + '/img/champion/' + m.champion + '.png';
    return '<div class="match-item ' + cls + '">' +
      '<img class="match-champ" src="' + img + '" onerror="this.style.display=\'none\'" />' +
      '<div class="match-result-dot ' + (m.win ? 'dot-win' : 'dot-loss') + '"></div>' +
      '<div class="match-info-box">' +
        '<span class="match-kda">' + m.kills + '/' + m.deaths + '/' + m.assists + '</span>' +
        '<span class="match-dur">' + formatDuration(m.gameDuration) + '</span>' +
      '</div>' +
    '</div>';
  });
  return '<div class="match-history">' + items.join('') + '</div>';
}

function buildCardHTML(acc) {
  var soloQ = acc.soloQ || { tier: 'UNRANKED', rank: '', leaguePoints: 0, wins: 0, losses: 0 };
  var total = soloQ.wins + soloQ.losses;
  var wr = total > 0 ? Math.round((soloQ.wins / total) * 100) : null;
  var iconId = acc.profileIconId || 29;
  var iconUrl = 'https://ddragon.leagueoflegends.com/cdn/' + DDragonVersion + '/img/profileicon/' + iconId + '.png';

  return '<div class="card-content-wrapper">' +
    '<div class="card-top">' +
      '<div class="icon-wrap">' +
        '<img src="' + iconUrl + '" onerror="this.src=\'' + FALLBACK_ICON_URL + '\'; this.onerror=null;" />' +
        '<span class="icon-level">' + acc.summonerLevel + '</span>' +
      '</div>' +
      '<div class="summoner-info">' +
        '<div class="summoner-name">' + escapeHTML(acc.gameName) + '</div>' +
        '<div class="summoner-tag">#' + escapeHTML(acc.tagLine) + '</div>' +
        '<div class="summoner-meta">' +
          '<span class="position-badge">' + escapeHTML(acc.mainPosition || '—') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="rank-block">' +
        '<div class="rank-emblem">' + (RANK_EMOJI[soloQ.tier] || '❓') + '</div>' +
        '<div class="rank-name" style="color:' + RANK_COLORS[soloQ.tier] + '">' + soloQ.tier + ' ' + soloQ.rank + '</div>' +
        '<div class="rank-lp">' + soloQ.leaguePoints + ' LP</div>' +
      '</div>' +
      '<div class="winrate-block">' +
        '<div class="wr-number">' + (wr ? wr + '%' : '—') + '</div>' +
        '<div class="wr-label">Winrate</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="refresh-btn" data-puuid="' + acc.puuid + '">↻</button>' +
        '<button class="remove-btn" data-puuid="' + acc.puuid + '">✕</button>' +
      '</div>' +
    '</div>' +
    buildMatchHistoryHTML(acc.matches) +
  '</div>';
}

function renderAccounts(accounts) {
  var grid = document.getElementById('accounts-grid');
  if (!grid) return;
  grid.innerHTML = accounts.length === 0 ? '<div class="empty-state">Sin cuentas</div>' : '';
  accounts.forEach(function(acc) {
    var div = document.createElement('div');
    div.className = 'account-card';
    div.innerHTML = buildCardHTML(acc);
    div.addEventListener('click', function(e) {
      if (e.target.closest('button')) return;
      var h = div.querySelector('.match-history');
      if (h) h.classList.toggle('active-history');
    });
    grid.appendChild(div);
  });
}

function showError(msg) {
  var el = document.getElementById('error-msg');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}