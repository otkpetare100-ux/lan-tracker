/**
 * compare.js — Sistema de comparación de cuentas
 */

(function () {
  if (window.__LAN_TRACKER_COMPARE_LOADED__) return;
  window.__LAN_TRACKER_COMPARE_LOADED__ = true;

  window.selectedToCompare = [];

  // ---- Toggle selección ----
  window.toggleCompare = function (puuid) {
    const idx = selectedToCompare.indexOf(puuid);
    if (idx !== -1) {
      selectedToCompare.splice(idx, 1);
    } else {
      if (selectedToCompare.length >= 2) {
        showError('Solo puedes comparar 2 cuentas a la vez.');
        return;
      }
      selectedToCompare.push(puuid);
    }
    updateCompareButtons();
    updateCompareBar();
  };

  function updateCompareButtons() {
    document.querySelectorAll('.compare-btn').forEach(btn => {
      const puuid = btn.dataset.puuid;
      const selected = selectedToCompare.includes(puuid);
      btn.classList.toggle('compare-btn--active', selected);
      btn.textContent = selected ? '✓ Comparar' : '⚖ Comparar';
    });
  }

  function updateCompareBar() {
    let bar = document.getElementById('compare-bar');
    if (selectedToCompare.length === 0) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'compare-bar';
      document.body.appendChild(bar);
    }
    if (selectedToCompare.length === 1) {
      bar.innerHTML = '<span>1 cuenta seleccionada — elige otra para comparar</span>' +
        '<button onclick="window.selectedToCompare=[];updateCompareButtons&&updateCompareButtons();this.closest(\'#compare-bar\').remove()">✕</button>';
    } else {
      bar.innerHTML = '<span>2 cuentas seleccionadas</span>' +
        '<button class="compare-bar__go" onclick="openCompareModal()">Ver comparación</button>' +
        '<button onclick="window.selectedToCompare=[];document.querySelectorAll(\'.compare-btn\').forEach(b=>{b.classList.remove(\'compare-btn--active\');b.textContent=\'⚖ Comparar\'});this.closest(\'#compare-bar\').remove()">✕</button>';
    }
  }

  // ---- Modal ----
  window.openCompareModal = function () {
    const accs = selectedToCompare.map(puuid => window._accounts_ref && window._accounts_ref.find(a => a.puuid === puuid)).filter(Boolean);
    if (accs.length !== 2) { showError('Selecciona 2 cuentas para comparar.'); return; }

    const existing = document.getElementById('compare-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'compare-modal';
    modal.innerHTML = buildModalHTML(accs[0], accs[1]);
    document.body.appendChild(modal);

    requestAnimationFrame(() => modal.classList.add('compare-modal--open'));

    modal.addEventListener('click', e => {
      if (e.target === modal) closeCompareModal();
    });
  };

  window.closeCompareModal = function () {
    const modal = document.getElementById('compare-modal');
    if (!modal) return;
    modal.classList.remove('compare-modal--open');
    setTimeout(() => modal.remove(), 280);
  };

  function buildModalHTML(a, b) {
    const rA = getRankInfoLocal(a);
    const rB = getRankInfoLocal(b);
    const wrA = computeWRLocal(rA.wins, rA.losses);
    const wrB = computeWRLocal(rB.wins, rB.losses);
    const wrABetter = wrA !== null && wrB !== null && wrA > wrB;
    const wrBBetter = wrA !== null && wrB !== null && wrB > wrA;
    const scoreA = getRankScoreLocal(a);
    const scoreB = getRankScoreLocal(b);

    return `
      <div class="compare-modal__box">
        <button class="compare-modal__close" onclick="closeCompareModal()">✕</button>
        <h2 class="compare-modal__title">⚖ Comparación</h2>
        <div class="compare-modal__grid">
          ${buildColumn(a, rA, wrA, wrABetter, scoreA > scoreB)}
          <div class="compare-modal__vs">VS</div>
          ${buildColumn(b, rB, wrB, wrBBetter, scoreB > scoreA)}
        </div>
      </div>`;
  }

  function buildColumn(acc, r, wr, wrBetter, rankBetter) {
    const RANK_COLORS = window.RANK_COLORS || {};
    const color = RANK_COLORS[r.tier] || '#aaa';
    const rankStr = r.tier === 'UNRANKED' ? 'Sin clasificar' : titleCaseLocal(r.tier) + ' ' + r.division;
    const rankIcon = `/pic/ranks/${r.tier.toLowerCase()}.png`;
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png`;
    const champsHTML = buildChampsLocal(acc.topChampions);

    return `
      <div class="compare-col">
        <img class="compare-col__avatar" src="${iconUrl}" onerror="this.src='${window.FALLBACK_ICON_URL}'">
        <div class="compare-col__name">${escapeHTMLLocal(acc.gameName)}</div>
        <div class="compare-col__tag">#${escapeHTMLLocal(acc.tagLine)}</div>

        <div class="compare-stat ${rankBetter ? 'compare-stat--better' : ''}">
          <img src="${rankIcon}" class="compare-rank-icon" onerror="this.style.display='none'">
          <span style="color:${color};font-weight:800">${rankStr}</span>
          <span class="compare-lp">${r.tier !== 'UNRANKED' ? r.lp + ' LP' : '—'}</span>
        </div>

        <div class="compare-stat ${wrBetter ? 'compare-stat--better' : ''}">
          <span class="compare-label">Winrate</span>
          <span class="compare-value ${wrBetter ? 'compare-value--good' : ''}">${wr !== null ? wr + '%' : '—'}</span>
          <span class="compare-sub">${r.wins}V ${r.losses}D</span>
        </div>

        <div class="compare-stat ${acc.summonerLevel >= (acc._otherLevel || 0) ? '' : ''}">
          <span class="compare-label">Nivel</span>
          <span class="compare-value">${acc.summonerLevel}</span>
        </div>

        <div class="compare-champs">
          <span class="compare-label">Top campeones</span>
          <div class="compare-champs__icons">${champsHTML}</div>
        </div>
      </div>`;
  }

  function buildChampsLocal(topChampions) {
    if (!topChampions || topChampions.length === 0) return '<span style="color:#666;font-size:0.75rem">Sin datos</span>';
    const fix = window.CHAMP_NAME_FIX || {};
    return topChampions.map(c => {
      if (!c.name) return '';
      const base = c.name.replace(/\.png$/i, '');
      const clean = base.replace(/[^a-zA-Z0-9]/g, '');
      const imgName = (fix[clean] || fix[base] || clean) + '.png';
      const img = `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${imgName}`;
      return `<img src="${img}" title="${escapeHTMLLocal(c.name)}" class="compare-champ-icon" onerror="this.style.display='none'">`;
    }).join('');
  }

  function getRankInfoLocal(acc) {
    const soloQ = acc.soloQ;
    if (!soloQ) return { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0 };
    return { tier: soloQ.tier, division: soloQ.rank, lp: soloQ.leaguePoints, wins: soloQ.wins, losses: soloQ.losses };
  }

  function computeWRLocal(wins, losses) {
    const total = wins + losses;
    return total === 0 ? null : Math.round((wins / total) * 100);
  }

  function getRankScoreLocal(acc) {
    const TIER_ORDER = { CHALLENGER:9,GRANDMASTER:8,MASTER:7,DIAMOND:6,EMERALD:5,PLATINUM:4,GOLD:3,SILVER:2,BRONZE:1,IRON:0,UNRANKED:-1 };
    const DIV_ORDER  = { I:4,II:3,III:2,IV:1 };
    const soloQ = acc.soloQ;
    if (!soloQ) return -1;
    return (TIER_ORDER[soloQ.tier]??-1)*10000 + (DIV_ORDER[soloQ.rank]??0)*1000 + (soloQ.leaguePoints||0);
  }

  function titleCaseLocal(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
  }

  function escapeHTMLLocal(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Keyboard close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCompareModal();
  });

})();