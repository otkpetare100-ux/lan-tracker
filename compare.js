/**
 * compare.js — Sistema de comparación de cuentas (Versión Corregida)
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
    if (!matches || !Array.isArray(matches) || matches.length === 0) return null;
    
    const t = matches.length;
    const s = matches.reduce((acc, m) => {
      acc.k += (m.kills || 0);
      acc.d += (m.deaths || 0);
      acc.a += (m.assists || 0);
      acc.cs += (m.cs || 0);
      acc.dmg += (m.damage || 0);
      acc.vis += (m.vision || 0);
      acc.g += (m.gold || 0);
      acc.kp += (m.kp || 0);
      acc.dur += (m.gameDuration || 0);
      return acc;
    }, { k:0, d:0, a:0, cs:0, dmg:0, vis:0, g:0, kp:0, dur:0 });

    // Si no hay datos reales, devolver null para mostrar "Sin datos"
    if (s.k === 0 && s.d === 0 && s.a === 0 && s.cs === 0 && s.dmg === 0) {
      return null;
    }

    const safeDeaths = s.d > 0 ? s.d : 1;
    const safeDuration = s.dur > 0 ? s.dur : t * 60; // Asumir 1 min por partida si no hay duración

    return {
      kda: ((s.k + s.a) / safeDeaths).toFixed(2),
      csMin: s.dur > 0 ? (s.cs / (s.dur / 60)).toFixed(1) : "0.0",
      damage: Math.round(s.dmg / t),
      vision: Math.round(s.vis / t),
      gold: Math.round(s.g / t),
      kp: Math.round(s.kp / t),
      duration: Math.round(s.dur / t)
    };
  }

  function buildStatRows(stats, statsOther) {
    if (!stats) {
      return '<div class="compare-stat" style="color: #7a84aa; padding: 20px;">Sin datos de partidas</div>';
    }

    return METRICS.map(function(m) {
      const valA = stats[m.key];
      const valB = (statsOther && statsOther[m.key] !== undefined) ? statsOther[m.key] : null;

      let isBetter = false;
      let diffBadge = '';
      let barPct = 50;

      if (valB !== null && valA !== null) {
        const isLowerBetter = m.key === 'duration';
        const fA = parseFloat(valA);
        const fB = parseFloat(valB);
        isBetter = isLowerBetter ? fA < fB : fA > fB;

        if (fA + fB > 0) {
          barPct = isLowerBetter
            ? Math.round((fB / (fA + fB)) * 100)
            : Math.round((fA / (fA + fB)) * 100);
        }

        if (isBetter && fB > 0) {
          const diff = Math.round(Math.abs((fA - fB) / fB) * 100);
          if (diff > 0) diffBadge = '<span class="compare-diff-badge">+' + diff + '%</span>';
        }
      } else if (valA !== null) {
        barPct = 100;
      }

      const barHTML = valB !== null
        ? '<div class="compare-bar-track"><div class="compare-bar-fill ' + (isBetter ? 'compare-bar-fill--better' : 'compare-bar-fill--worse') + '" style="--bar-pct:' + barPct + '%"></div></div>'
        : '';

      return '<div class="compare-stat ' + (isBetter ? 'compare-stat--better' : '') + '">' +
        '<div class="compare-stat__header"><span class="compare-label">' + m.label + '</span>' + diffBadge + '</div>' +
        '<span class="compare-value ' + (['damage','gold'].includes(m.key) ? 'compare-value--xl' : '') + '">' +
          (valA !== null && valA !== undefined ? m.format(valA) : '—') +
        '</span>' +
        barHTML +
      '</div>';
    }).join('');
  }

  window.toggleCompare = function (puuid) {
    const idx = selectedToCompare.indexOf(puuid);
    if (idx !== -1) {
      selectedToCompare.splice(idx, 1);
    } else {
      if (selectedToCompare.length >= 2) {
        showError('Solo puedes comparar 2 cuentas.');
        return;
      }
      selectedToCompare.push(puuid);
    }
    
    // Verificar que las cuentas tengan historial cargado
    if (selectedToCompare.length === 2) {
      const accs = selectedToCompare
        .map(p => window._accounts_ref?.find(a => a.puuid === p))
        .filter(Boolean);
      
      const sinHistorial = accs.filter(acc => !acc.matches || acc.matches.length === 0);
      if (sinHistorial.length > 0) {
        const nombres = sinHistorial.map(a => a.gameName).join(' y ');
        showError(`${nombres} no tienen historial cargado. Haz clic en "Ver historial" primero.`);
      }
    }
    
    updateCompareButtons();
    updateCompareBar();
  };

  window.updateCompareButtons = function updateCompareButtons() {
    document.querySelectorAll('.compare-btn').forEach(btn => {
      const selected = selectedToCompare.includes(btn.dataset.puuid);
      btn.classList.toggle('compare-btn--active', selected);
      btn.textContent = selected ? '✓ Comparar' : '⚖ Comparar';
    });
  }

  function updateCompareBar() {
    let bar = document.getElementById('compare-bar');
    if (selectedToCompare.length === 0) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'compare-bar';
      document.body.appendChild(bar);
    }
    
    bar.innerHTML = selectedToCompare.length === 1 
      ? `<span>1 cuenta seleccionada — Selecciona otra</span>
         <button onclick="window.selectedToCompare=[];document.getElementById('compare-bar')?.remove();updateCompareButtons()">✕ Cancelar</button>`
      : `<span>2 cuentas listas</span>
         <button class="compare-bar__go" onclick="openCompareModal()">⚔ Ver comparación</button>
         <button onclick="window.selectedToCompare=[];document.getElementById('compare-bar')?.remove();updateCompareButtons()">✕ Cancelar</button>`;
  }

  window.openCompareModal = function () {
    const accs = selectedToCompare
      .map(p => window._accounts_ref?.find(a => a.puuid === p))
      .filter(Boolean);
    
    if (accs.length !== 2) return;
    
    const statsA = getStatsAverages(accs[0].matches);
    const statsB = getStatsAverages(accs[1].matches);

    let scoreA = 0, scoreB = 0;
    if (statsA && statsB) {
      METRICS.forEach(function(m) {
        const fA = parseFloat(statsA[m.key]);
        const fB = parseFloat(statsB[m.key]);
        if (!isNaN(fA) && !isNaN(fB) && fA !== fB) {
          if (m.key === 'duration' ? fA < fB : fA > fB) scoreA++;
          else scoreB++;
        }
      });
    }

    const modal = document.createElement('div');
    modal.id = 'compare-modal';
    modal.innerHTML =
      '<div class="compare-modal__box">' +
        '<div class="compare-modal__header">' +
          '<h2 class="compare-modal__title">⚖ Comparación</h2>' +
          '<button class="compare-modal__close" onclick="closeCompareModal()">✕</button>' +
        '</div>' +
        '<div class="compare-modal__body">' +
          '<div class="compare-modal__grid">' +
            buildColumn(accs[0], statsA, statsB) +
            '<div class="compare-modal__vs">' +
              '<div class="compare-vs-score ' + (scoreA > scoreB ? 'compare-vs-score--win' : scoreA < scoreB ? 'compare-vs-score--lose' : '') + '">' + scoreA + '</div>' +
              '<div class="compare-vs-label">VS</div>' +
              '<div class="compare-vs-score ' + (scoreB > scoreA ? 'compare-vs-score--win' : scoreB < scoreA ? 'compare-vs-score--lose' : '') + '">' + scoreB + '</div>' +
            '</div>' +
            buildColumn(accs[1], statsB, statsA) +
          '</div>' +
        '</div>' +
      '</div>';
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('compare-modal--open'));
    
    // Evento para cerrar con Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeCompareModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  };

  function buildColumn(acc, stats, statsOther) {
    const rankInfo = getRankInfoForCompare(acc);
    const champsHTML = buildChampsHTMLForCompare(acc.topChampions);
    
    return `
      <div class="compare-col">
        <img class="compare-col__avatar" 
             src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${acc.profileIconId}.png"
             alt="${escapeHTML(acc.gameName)}"
             onerror="this.src='${FALLBACK_ICON_URL}'" />
        <div class="compare-col__name">${escapeHTML(acc.gameName)}</div>
        <div class="compare-col__tag">#${escapeHTML(acc.tagLine)}</div>
        ${rankInfo}
        ${champsHTML}
        <div class="compare-stats-container">
          ${buildStatRows(stats, statsOther)}
        </div>
      </div>`;
  }

  function getRankInfoForCompare(acc) {
    if (!acc.soloQ) {
      return '<div class="compare-rank-row"><span style="color:#7a84aa;font-size:0.78rem;">Sin clasificar</span></div>';
    }

    const tier   = titleCase(acc.soloQ.tier || '');
    const rank   = acc.soloQ.rank || '';
    const lp     = acc.soloQ.leaguePoints || 0;
    const wins   = acc.soloQ.wins   || 0;
    const losses = acc.soloQ.losses || 0;
    const total  = wins + losses;
    const wr     = total > 0 ? Math.round((wins / total) * 100) : null;
    const color  = RANK_COLORS[acc.soloQ.tier] || '#7a84aa';

    var iconSrc = (typeof RANK_ICONS !== 'undefined' && RANK_ICONS[acc.soloQ.tier]) || null;
    var iconHTML = iconSrc ? '<img class="compare-rank-icon" src="' + iconSrc + '" alt="' + tier + '" />' : '';
    var wrClass  = wr === null ? '' : wr >= 55 ? 'compare-wr--good' : wr >= 48 ? 'compare-wr--ok' : 'compare-wr--bad';
    var wrHTML   = wr !== null
      ? '<div class="compare-wr ' + wrClass + '">' + wr + '% <span class="compare-wr-record">' + wins + 'V ' + losses + 'D</span></div>'
      : '';

    return '<div class="compare-rank-row">' +
        iconHTML +
        '<div class="compare-rank-text">' +
          '<div style="color:' + color + ';font-weight:700;font-size:0.82rem;">' + tier + ' ' + rank + '</div>' +
          '<div class="compare-lp">' + lp + ' LP</div>' +
        '</div>' +
      '</div>' + wrHTML;
  }

  function buildChampsHTMLForCompare(champions) {
    if (!champions || champions.length === 0) return '';
    
    const icons = champions
      .filter(c => c.name)
      .slice(0, 3)
      .map(c => {
        const imgName = getChampImageName(c.name);
        return `<img class="compare-champ-icon" 
                     src="https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${imgName}"
                     alt="${escapeHTML(c.name)}"
                     title="${escapeHTML(c.name)}"
                     onerror="this.remove()" />`;
      })
      .join('');
    
    return `<div class="compare-champs">
      <div class="compare-label" style="margin-top: 8px;">Top Campeones</div>
      <div class="compare-champs__icons">${icons}</div>
    </div>`;
  }

  window.closeCompareModal = () => {
    const modal = document.getElementById('compare-modal');
    if (modal) {
      modal.classList.remove('compare-modal--open');
      setTimeout(() => modal.remove(), 300);
    }
    window.selectedToCompare = [];
    document.getElementById('compare-bar')?.remove();
    updateCompareButtons();
  };

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function titleCase(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
  }

  function getChampImageName(name) {
    if (!name) return 'Unknown.png';
    var base = name.replace(/\.png$/i, '');
    var clean = base.replace(/[^a-zA-Z0-9]/g, '');
    const CHAMP_NAME_FIX = {
      'AurelionSol': 'AurelionSol', 'Belveth': 'Belveth', 'Chogath': 'Chogath',
      'DrMundo': 'DrMundo', 'JarvanIV': 'JarvanIV', 'Kaisa': 'Kaisa',
      'Khazix': 'Khazix', 'KogMaw': 'KogMaw', 'KSante': 'KSante',
      'Leblanc': 'Leblanc', 'LeeSin': 'LeeSin', 'MasterYi': 'MasterYi',
      'MissFortune': 'MissFortune', 'MonkeyKing': 'MonkeyKing', 'Wukong': 'MonkeyKing',
      'Nunu': 'Nunu', 'NunuWillump': 'Nunu', 'RekSai': 'RekSai',
      'TahmKench': 'TahmKench', 'TwistedFate': 'TwistedFate', 'Velkoz': 'Velkoz',
      'XinZhao': 'XinZhao', 'Fiddlesticks': 'Fiddlesticks', 'FiddleSticks': 'Fiddlesticks',
      'fiddlesticks': 'Fiddlesticks', 'Renata': 'Renata', 'RenataGlasc': 'Renata', 'Mel': 'Mel',
    };
    return (CHAMP_NAME_FIX[clean] || CHAMP_NAME_FIX[base] || clean) + '.png';
  }
})();