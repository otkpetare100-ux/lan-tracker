/**
 * app.js — Main controller for LAN Tracker
 */

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

let accounts = [];

const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const accountsGrid = document.getElementById('accounts-grid');

// Orden de rangos para comparar
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

async function init() {
  accounts = await loadAccounts();
  renderAccounts(sortByRank(accounts));
}
init();

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
    showError('Formato invalido. Usa Nombre#TAG  (ej: Pepitoflow#LAN1)');
    return;
  }

  const [gameName, tagLine] = parts;
  searchBtn.disabled = true;
  searchBtn.textContent = '...';

  try {
    const entry  = await fetchAccountSnapshot(gameName, tagLine);
    const result = await saveAccountToServer(entry);

    if (!result.added) {
      showError('Esta cuenta ya esta en la lista.');
    } else {
      accounts.push(entry);
      renderAccounts(sortByRank(accounts));
      searchInput.value = '';
    }
  } catch (err) {
    const msg = err.status
      ? getApiErrorMessage(err.status)
      : 'Error de red: ' + err.message;
    showError(msg);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  }
}

/* ---- Refresh ---- */
async function handleRefresh(puuid, silent = false) {
  const acc = accounts.find(a => a.puuid === puuid);
  if (!acc) return;

  const card = document.getElementById('card-' + puuid);
  if (card) {
    const btn = card.querySelector('.refresh-btn');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
  }

  try {
    const updated = await fetchAccountSnapshot(acc.gameName, acc.tagLine);
    await updateAccountOnServer(updated);
    accounts = accounts.map(a => a.puuid === puuid ? updated : a);
    renderAccounts(sortByRank(accounts));
  } catch (err) {
    if (!silent) {
      showError(err.status ? getApiErrorMessage(err.status) : 'Error de red: ' + err.message);
    }
    const card = document.getElementById('card-' + puuid);
    if (card) {
      const btn = card.querySelector('.refresh-btn');
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
  }
}

/* ---- Event delegation ---- */
accountsGrid.addEventListener('click', async (e) => {
  const removeBtn  = e.target.closest('.remove-btn');
  const refreshBtn = e.target.closest('.refresh-btn');

  if (removeBtn) {
    const puuid = removeBtn.dataset.puuid;
    await deleteAccountFromServer(puuid);
    accounts = accounts.filter(a => a.puuid !== puuid);
    renderAccounts(sortByRank(accounts));
  }

  if (refreshBtn) {
    const puuid = refreshBtn.dataset.puuid;
    handleRefresh(puuid);
  }
});

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});
