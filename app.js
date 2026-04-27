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
  renderAccounts(sortByRank(accounts));
}
init();

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
      renderAccounts(sortByRank(accounts));
      searchInput.value = '';
    }
  } catch (err) {
    console.error('Error capturado en handleSearch:', err);
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
    const updated = await fetchAccountSnapshot(acc.gameName, acc.tagLine);

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
    accounts = accounts.map(a => a.puuid === puuid ? updated : a);
    updateGlobalRef();
    
    const wasOpen = card && document.getElementById('history-' + puuid) &&
                    document.getElementById('history-' + puuid).style.display !== 'none';

    renderAccounts(sortByRank(accounts));

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
      renderAccounts(sortByRank(accounts));
      const newContent = document.getElementById('history-' + puuid);
      const newBtn     = document.querySelector('.history-toggle-btn[data-puuid="' + puuid + '"]');
      if (newContent) newContent.style.display = 'block';
      if (newBtn) {
        newBtn.querySelector('.history-arrow').textContent = '▴';
        newBtn.querySelector('.history-btn-text').textContent = 'Ocultar historial';
      }
    } catch(e) {
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
      renderAccounts(sortByRank(accounts));
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