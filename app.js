/**
 * app.js — Main controller for LAN Tracker
 */

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

let accounts = [];

const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const accountsGrid = document.getElementById('accounts-grid');

// Carga inicial desde el servidor
async function init() {
  accounts = await loadAccounts();
  renderAccounts(accounts);
}
init();

// Auto-refresh cada 5 minutos
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
      renderAccounts(accounts);
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
    renderAccounts(accounts);
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
    renderAccounts(accounts);
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
