/**
 * app.js — Main controller for LAN Tracker
 *
 * Wires together api.js, storage.js, and render.js.
 * Handles user interactions and application state.
 */

/* ---- State ---- */
let accounts = loadAccounts();

/* ---- DOM References ---- */
const searchInput = document.getElementById('search-input');
const searchBtn   = document.getElementById('search-btn');
const accountsGrid = document.getElementById('accounts-grid');

/* ---- Init ---- */
renderAccounts(accounts);

/* ---- Search handler ---- */

async function handleSearch() {
  const raw = searchInput.value.trim();
  showError('');

  if (!raw) return;

  // Validate format
  const parts = raw.split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    showError('Formato inválido. Usa Nombre#TAG  (ej: Pepitoflow#LAN1)');
    return;
  }

  const [gameName, tagLine] = parts;

  // Lock UI
  searchBtn.disabled = true;
  searchBtn.textContent = '...';

  try {
    const entry = await fetchAccountSnapshot(gameName, tagLine);
    const result = addAccount(accounts, entry);

    if (!result.added) {
      showError('Esta cuenta ya está en la lista.');
    } else {
      accounts = result.accounts;
      renderAccounts(accounts);
      searchInput.value = '';
    }

  } catch (err) {
    const msg = err.status
      ? getApiErrorMessage(err.status)
      : `Error de red: ${err.message}`;
    showError(msg);
    console.error('[LAN Tracker] API error:', err);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  }
}

/* ---- Remove handler (event delegation) ---- */

accountsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-btn');
  if (!btn) return;

  const puuid = btn.dataset.puuid;
  if (!puuid) return;

  accounts = removeAccount(accounts, puuid);
  renderAccounts(accounts);
});

/* ---- Event listeners ---- */

searchBtn.addEventListener('click', handleSearch);

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});
