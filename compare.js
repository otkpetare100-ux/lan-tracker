/**
 * compare.js — Sistema de comparación de cuentas (Versión Completa)
 */
(function () {
  if (window.__LAN_TRACKER_COMPARE_LOADED__) return;
  window.__LAN_TRACKER_COMPARE_LOADED__ = true;
  window.selectedToCompare = [];

  const METRICS = [
    { key: 'kda',    label: 'KDA',           format: v => v },
    { key: 'csMin',  label: 'CS / Min',      format: v => v },
    { key: 'damage', label: 'Daño total',    format: v => v.toLocaleString() },
    { key: 'vision', label: 'Visión',        format: v => v },
    { key: 'gold',   label: 'Oro',           format: v => v.toLocaleString() },
    { key: 'kp',     label: 'Part. Kills',   format: v => v + '%' },
    { key: 'duration', label: 'Dur. Prom.',  format: v => Math.floor(v/60) + ':' + (v%60).toString().padStart(2, '0') }
  ];

  function getStatsAverages(matches) {
    if (!matches || matches.length === 0) return null;
    const t = matches.length;
    const s = matches.reduce((acc, m) => {
      acc.k += m.kills; acc.d += m.deaths; acc.a += m.assists;
      acc.cs += m.cs; acc.dmg += m.damage; acc.vis += m.vision;
      acc.g += m.gold; acc.kp += m.kp; acc.dur += m.gameDuration;
      return acc;
    }, { k:0, d:0, a:0, cs:0, dmg:0, vis:0, g:0, kp:0, dur:0 });
    return {
      kda: ((s.k + s.a) / (s.d || 1)).toFixed(2),
      csMin: (s.cs / (s.dur / 60)).toFixed(1),
      damage: Math.round(s.dmg / t),
      vision: Math.round(s.vis / t),
      gold: Math.round(s.g / t),
      kp: Math.round(s.kp / t),
      duration: Math.round(s.dur / t)
    };
  }

  function buildStatRows(stats, statsOther) {
    if (!stats) return '';
    return METRICS.map(m => {
      const valA = stats[m.key];
      const valB = statsOther ? statsOther[m.key] : 0;
      const isBetter = valA > valB;
      return `
        <div class="compare-stat ${isBetter ? 'compare-stat--better' : ''}">
          <span class="compare-label">${m.label}</span>
          <span class="compare-value ${['damage','kda'].includes(m.key) ? 'compare-value--xl' : ''}">
            ${valA !== null ? m.format(valA) : '—'}
          </span>
        </div>`;
    }).join('');
  }

  window.toggleCompare = function (puuid) {
    const idx = selectedToCompare.indexOf(puuid);
    if (idx !== -1) selectedToCompare.splice(idx, 1);
    else {
      if (selectedToCompare.length >= 2) { showError('Solo puedes comparar 2 cuentas.'); return; }
      selectedToCompare.push(puuid);
    }
    updateCompareButtons(); updateCompareBar();
  };

  function updateCompareButtons() {
    document.querySelectorAll('.compare-btn').forEach(btn => {
      const selected = selectedToCompare.includes(btn.dataset.puuid);
      btn.classList.toggle('compare-btn--active', selected);
      btn.textContent = selected ? '✓ Comparar' : '⚖ Comparar';
    });
  }

  function updateCompareBar() {
    let bar = document.getElementById('compare-bar');
    if (selectedToCompare.length === 0) { bar?.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'compare-bar'; document.body.appendChild(bar); }
    bar.innerHTML = selectedToCompare.length === 1 
      ? '<span>1 cuenta seleccionada</span><button onclick="window.selectedToCompare=[];this.closest(\'#compare-bar\').remove()">✕</button>'
      : '<span>2 cuentas</span><button class="compare-bar__go" onclick="openCompareModal()">Ver comparación</button><button onclick="window.selectedToCompare=[];location.reload()">✕</button>';
  }

  window.openCompareModal = function () {
    const accs = selectedToCompare.map(p => window._accounts_ref?.find(a => a.puuid === p)).filter(Boolean);
    if (accs.length !== 2) return;
    const statsA = getStatsAverages(accs[0].matches);
    const statsB = getStatsAverages(accs[1].matches);
    const modal = document.createElement('div');
    modal.id = 'compare-modal';
    modal.innerHTML = `
      <div class="compare-modal__box">
        <button class="compare-modal__close" onclick="closeCompareModal()">✕</button>
        <h2 class="compare-modal__title">⚖ Comparación</h2>
        <div class="compare-modal__grid">
          ${buildColumn(accs[0], statsA, statsB)}
          <div class="compare-modal__vs">VS</div>
          ${buildColumn(accs[1], statsB, statsA)}
        </div>
      </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('compare-modal--open'));
  };

  function buildColumn(acc, stats, statsOther) {
    return `
      <div class="compare-col">
        <img class="compare-col__avatar" src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png">
        <div class="compare-col__name">${escapeHTMLLocal(acc.gameName)}</div>
        <div class="compare-stats-container">${buildStatRows(stats, statsOther)}</div>
      </div>`;
  }

  window.closeCompareModal = () => document.getElementById('compare-modal')?.remove();
  function escapeHTMLLocal(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeCompareModal(); });
})();