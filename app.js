/**
 * app.js — Main controller for LAN Tracker
 */

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

let accounts = [];
const refreshCooldowns = {};
const REFRESH_COOLDOWN = 60 * 1000;

const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const accountsGrid = document.getElementById('accounts-grid');
const filterInput  = document.getElementById('filter-input');


const TIER_ORDER = {
  CHALLENGER: 9, GRANDMASTER: 8, MASTER: 7,
  DIAMOND: 6, EMERALD: 5, PLATINUM: 4,
  GOLD: 3, SILVER: 2, BRONZE: 1, IRON: 0, UNRANKED: -1,
};
const DIV_ORDER = { I: 4, II: 3, III: 2, IV: 1 };

function getRankScore(acc) {
  const soloQ = acc.soloQ;
  if (!soloQ) return -1;
  const tier = TIER_ORDER[soloQ.tier] ?? -1;
  const div  = DIV_ORDER[soloQ.rank]  ?? 0;
  const lp   = soloQ.leaguePoints     || 0;
  return tier * 10000 + div * 1000 + lp;
}

function sortByRank(list) {
  return [...list].sort((a, b) => getRankScore(b) - getRankScore(a));
}

function updateGlobalRef() {
  window._accounts_ref = accounts;
}

async function init() {
  accounts = await loadAccounts();
  updateGlobalRef();
  applyFilters();
  // checkAllLiveStatus(); // Deshabilitado temporalmente (403 dev key)
}
init();

async function checkAllLiveStatus() {
  if (!accounts || accounts.length === 0) return;
  for (const acc of accounts) {
    try {
      const game = await getActiveGame(acc.puuid);
      acc.isLive = !!game;
    } catch(e) { acc.isLive = false; }
  }
  applyFilters();
}

// setInterval(checkAllLiveStatus, 180000); // 3 minutos (Deshabilitado temporalmente)

// Auto-refresh activado
setInterval(async () => {
  if (accounts.length === 0) return;
  for (const acc of accounts) {
    await handleRefresh(acc.puuid, true);
  }
}, AUTO_REFRESH_INTERVAL);

/* ---- Search ---- */
async function handleSearch() {
  const raw = searchInput.value.trim();
  showError('');
  if (!raw) return;

  const parts = raw.split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    showError('Formato inválido. Usa Nombre#TAG (ej: Pepitoflow#LAN1)');
    return;
  }

  const [gameName, tagLine] = parts;
  searchBtn.disabled = true;
  searchBtn.textContent = '...';

  try {
    const entry  = await fetchAccountSnapshot(gameName, tagLine);
    const result = await saveAccount(entry);
    if (!result.added) {
      showError('Esta cuenta ya está en la lista.');
    } else {
      accounts.push(entry);
      updateGlobalRef();
      applyFilters();
      searchInput.value = '';
    }
  } catch (err) {
    showError(err.status ? getApiErrorMessage(err.status) : 'Error de red: ' + err.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  }
}

/* ---- Helpers para actualizar campeones desde historial ---- */
function championsFromMatches(matches) {
  if (!matches || matches.length === 0) return null;
  const champCount = {};
  for (const m of matches) {
    if (!champCount[m.champion]) champCount[m.champion] = 0;
    champCount[m.champion]++;
  }
  return Object.entries(champCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(function([name]) {
      return { name: name, image: name };
    });
}

/* ---- Refresh ---- */
async function handleRefresh(puuid, silent = false) {
  const acc = accounts.find(a => a.puuid === puuid);
  if (!acc) return;

  if (!silent) {
    const lastRefresh = refreshCooldowns[puuid] || 0;
    const elapsed = Date.now() - lastRefresh;
    if (elapsed < REFRESH_COOLDOWN) {
      const seconds = Math.ceil((REFRESH_COOLDOWN - elapsed) / 1000);
      showError('Espera ' + seconds + ' segundos para actualizar esta cuenta.');
      clearTimeout(window._errorTimeout);
      window._errorTimeout = setTimeout(() => showError(''), 5000);
      return;
    }
    refreshCooldowns[puuid] = Date.now();
  }

  const card = document.getElementById('card-' + puuid);
  const btn = card ? card.querySelector('.refresh-btn') : null;
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

  try {
    // --- Funcionalidad 4: Caché Inteligente ---
    const matchIds = await getMatchIds(acc.puuid);
    const lastId = matchIds && matchIds.length > 0 ? matchIds[0] : null;
    
    if (lastId && acc.lastGameId === lastId) {
      if (!silent) showToast('Sin partidas nuevas desde el último refresh', 'toast-neutral');
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
      return;
    }

    const updated = await fetchAccountSnapshot(acc.gameName, acc.tagLine);
    updated.lastGameId = lastId; // Guardar ID para próxima comparación

    // Siempre intentamos obtener el historial de partidas para tener las 20 últimas
    if (btn) btn.classList.remove('spinning');
    
    const history = await fetchMatchHistory(acc.puuid, (curr, total) => {
      if (btn) {
        btn.classList.add('refresh-btn--loading');
        btn.innerHTML = `<span class="refresh-progress">${curr}/${total}</span>`;
      }
    });

    if (history && history.matches) {
      updated.matches      = history.matches;
      updated.streak       = history.streak;
      updated.mainPosition = history.mainPosition;
      const champs = championsFromMatches(history.matches);
      if (champs) updated.topChampions = champs;
    } else {
      updated.matches      = acc.matches || [];
      updated.streak       = acc.streak  || 0;
      updated.mainPosition = acc.mainPosition || '—';
      updated.topChampions = acc.topChampions || [];
    }

    await updateAccount(updated);
    
    // Toast y guardado de historial de cambio de rango
    const prevSoloQ = acc.soloQ;
    const newSoloQ  = updated.soloQ;
    showRankChangeToast(updated.gameName, prevSoloQ, newSoloQ);
    saveRankHistoryIfNeeded(acc, newSoloQ, prevSoloQ);

    // --- Funcionalidad 3: Rachas Históricas ---
    if (!updated.records) updated.records = acc.records || { maxWinStreak: 0, maxLossStreak: 0 };
    const currentStreak = updated.streak || 0;
    
    if (currentStreak > 0 && currentStreak > (updated.records.maxWinStreak || 0)) {
      updated.records.maxWinStreak = currentStreak;
      showToast(`🔥 ¡NUEVO RÉCORD! ${updated.gameName} racha de ${currentStreak} victorias`, 'toast-up');
      triggerRankUpCelebration(); // Reutilizar celebración
    } else if (currentStreak < 0 && Math.abs(currentStreak) > (updated.records.maxLossStreak || 0)) {
      updated.records.maxLossStreak = Math.abs(currentStreak);
    }


    accounts = accounts.map(a => a.puuid === puuid ? updated : a);
    updateGlobalRef();
    
    const wasOpen = card && document.getElementById('history-' + puuid) &&
                    document.getElementById('history-' + puuid).style.display !== 'none';

    applyFilters();

    if (wasOpen) {
      const newContent = document.getElementById('history-' + puuid);
      const newBtn     = document.querySelector('.history-toggle-btn[data-puuid="' + puuid + '"]');
      if (newContent) newContent.style.display = 'block';
      if (newBtn) {
        newBtn.querySelector('.history-arrow').textContent = '▴';
        newBtn.querySelector('.history-btn-text').textContent = 'Ocultar historial';
      }
    }

  } catch (err) {
    if (!silent) {
      showError(err.status ? getApiErrorMessage(err.status) : 'Error de red: ' + err.message);
    }
    const c = document.getElementById('card-' + puuid);
    if (c) {
      const btn = c.querySelector('.refresh-btn');
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
  }
}

/* ---- History toggle ---- */
async function handleHistoryToggle(puuid) {
  const content = document.getElementById('history-' + puuid);
  const btn     = document.querySelector('.history-toggle-btn[data-puuid="' + puuid + '"]');
  if (!content || !btn) return;

  const isOpen = content.style.display !== 'none';

  if (isOpen) {
    content.style.display = 'none';
    btn.querySelector('.history-arrow').textContent = '▾';
    btn.querySelector('.history-btn-text').textContent = 'Ver historial';
    return;
  }

  const acc = accounts.find(a => a.puuid === puuid);
  if (!acc) return;

  if (!acc.matches || acc.matches.length === 0) {
    btn.classList.add('loading-history');
    btn.querySelector('.history-btn-text').textContent = 'Cargando...';
    btn.disabled = true;

    try {
      const history = await fetchMatchHistory(puuid);
      acc.matches      = history.matches;
      acc.streak       = history.streak;
      acc.mainPosition = history.mainPosition;
      const champs = championsFromMatches(history.matches);
      if (champs) acc.topChampions = champs;
      accounts = accounts.map(a => a.puuid === puuid ? acc : a);
      updateGlobalRef();
      await updateAccount(acc);
      applyFilters();
      const newContent = document.getElementById('history-' + puuid);
      const newBtn     = document.querySelector('.history-toggle-btn[data-puuid="' + puuid + '"]');
      if (newContent) newContent.style.display = 'block';
      if (newBtn) {
        newBtn.querySelector('.history-arrow').textContent = '▴';
        newBtn.querySelector('.history-btn-text').textContent = 'Ocultar historial';
      }
    } catch(e) {
      btn.classList.remove('loading-history');
      btn.querySelector('.history-btn-text').textContent = 'Ver historial';
      btn.disabled = false;
      showError('Error cargando historial: ' + e.message);
    }
    return;
  }

  content.style.display = 'block';
  btn.querySelector('.history-arrow').textContent = '▴';
  btn.querySelector('.history-btn-text').textContent = 'Ocultar historial';
}

/* ---- Event delegation ---- */
accountsGrid.addEventListener('click', async (e) => {
  const removeBtn  = e.target.closest('.remove-btn');
  const refreshBtn = e.target.closest('.refresh-btn');
  const historyBtn = e.target.closest('.history-toggle-btn');
  const noteBtn    = e.target.closest('.note-btn');
  const shareBtn   = e.target.closest('.share-btn');

  if (noteBtn) {
    const puuid = noteBtn.dataset.puuid;
    if (typeof openNoteModal === 'function') openNoteModal(puuid);
  }

  if (shareBtn) {
    const puuid = shareBtn.dataset.puuid;
    const acc = accounts.find(a => a.puuid === puuid);
    if (acc) {
      const url = `https://lan-tracker-production.up.railway.app/player/${encodeURIComponent(acc.gameName)}-${encodeURIComponent(acc.tagLine)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('🔗 ¡Link copiado al portapapeles!', 'toast-up');
      }).catch(err => {
        showError('No se pudo copiar el link');
      });
    }
  }

  if (removeBtn) {
    const puuid = removeBtn.dataset.puuid;
    const acc = accounts.find(a => a.puuid === puuid);
    showDeleteConfirm(acc?.gameName || 'esta cuenta', async () => {
      await deleteAccount(puuid);
      accounts = accounts.filter(a => a.puuid !== puuid);
      updateGlobalRef();
      // Limpiar comparación si la cuenta eliminada estaba seleccionada
      if (window.selectedToCompare) {
        window.selectedToCompare = window.selectedToCompare.filter(p => p !== puuid);
      }
      applyFilters();
    });
  }

  if (refreshBtn) {
    const puuid = refreshBtn.dataset.puuid;
    handleRefresh(puuid);
  }

  if (historyBtn) {
    const puuid = historyBtn.dataset.puuid;
    handleHistoryToggle(puuid);
  }
});

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

/* ---- Búsqueda y Filtro en Cliente ---- */
function applyFilters() {
  const query = (filterInput ? filterInput.value : '').toLowerCase().trim();
  
  let filtered = accounts;
  
  // Filtro por nombre
  if (query) {
    filtered = filtered.filter(a => a.gameName.toLowerCase().includes(query));
  }
  
  renderAccounts(sortByRank(filtered));
}

if (filterInput) {
  filterInput.addEventListener('input', applyFilters);
}


/* ---- Toasts de Rango ---- */
function showRankChangeToast(name, prev, next) {
  if (!prev || !next || prev.tier === 'UNRANKED' || next.tier === 'UNRANKED') return;
  const prevScore = (TIER_ORDER[prev.tier] ?? -1) * 10000 + (DIV_ORDER[prev.rank] ?? 0) * 1000 + (prev.leaguePoints || 0);
  const nextScore = (TIER_ORDER[next.tier] ?? -1) * 10000 + (DIV_ORDER[next.rank] ?? 0) * 1000 + (next.leaguePoints || 0);
  if (prevScore === nextScore) return;
  
  const noDivTiers = ['MASTER','GRANDMASTER','CHALLENGER'];
  const fmt = r => noDivTiers.includes(r.tier) ? r.tier : `${r.tier} ${r.rank}`;
  
  const promoted  = nextScore > prevScore;
  const sameDiv   = prev.tier === next.tier && prev.rank === next.rank;
  
  const emoji     = promoted ? '🎉' : '💀';
  const color     = promoted ? 'toast-up' : 'toast-down';
  const msg       = sameDiv
    ? `${name}: ${prev.leaguePoints} → ${next.leaguePoints} LP`
    : promoted
      ? `¡${name} subió a ${fmt(next)}!`
      : `${name} bajó a ${fmt(next)}`;
      
  showToast(emoji + ' ' + msg, color);
  
  if (promoted && !sameDiv) {
    triggerRankUpCelebration();
  }
}

function triggerRankUpCelebration() {
  const container = document.createElement('div');
  container.className = 'rank-celebration-container';
  document.body.appendChild(container);

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle-gold';
    particle.style.left = Math.random() * 100 + 'vw';
    particle.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
    particle.style.animationDelay = (Math.random() * 0.5) + 's';
    container.appendChild(particle);
  }

  setTimeout(() => {
    container.remove();
  }, 3500);
}

function showToast(message, cls = '') {
  const t = document.createElement('div');
  t.className = 'rank-toast ' + cls;
  t.textContent = message;
  document.body.appendChild(t);
  
  requestAnimationFrame(() => t.classList.add('rank-toast--show'));
  
  setTimeout(() => {
    t.classList.remove('rank-toast--show');
    setTimeout(() => t.remove(), 400);
  }, 5000);
}

/* ---- Historial de Rangos ---- */
async function saveRankHistoryIfNeeded(acc, newSoloQ, prevSoloQ) {
  if (!newSoloQ || newSoloQ.tier === 'UNRANKED') return;
  
  // Guardamos solo si cambió el tier, división o lp
  const changed = !prevSoloQ || 
                  prevSoloQ.tier !== newSoloQ.tier || 
                  prevSoloQ.rank !== newSoloQ.rank || 
                  prevSoloQ.leaguePoints !== newSoloQ.leaguePoints;
                  
  if (changed) {
    const entry = {
      puuid: acc.puuid,
      gameName: acc.gameName,
      tagLine: acc.tagLine,
      rank: {
        tier: newSoloQ.tier,
        division: newSoloQ.rank,
        lp: newSoloQ.leaguePoints
      }
    };
    await postRankHistory(entry);
  }
}

/* ---- Notas por Cuenta ---- */
async function saveNote(puuid) {
  const textarea = document.getElementById(`note-textarea-${puuid}`);
  if (!textarea) return;
  
  const text = textarea.value.trim().substring(0, 200);
  const acc = accounts.find(a => a.puuid === puuid);
  if (!acc) return;
  
  acc.notes = text;
  
  const btn = document.querySelector(`.note-save`);
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
  
  const ok = await updateAccount(acc);
  
  if (ok) {
    accounts = accounts.map(a => a.puuid === puuid ? acc : a);
    updateGlobalRef();
    if (typeof closeNoteModal === 'function') closeNoteModal();
    applyFilters();
    showToast('📝 Nota guardada', 'toast-up');
  } else {
    showError('Error al guardar la nota');
    if (btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
  }
}