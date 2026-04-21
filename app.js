/**
 * app.js — Main controller for LAN Tracker
 */

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

let accounts = loadAccounts();

const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const accountsGrid = document.getElementById('accounts-grid');

// Render inicial
renderAccounts(accounts);

/* ---- Lógica de Negocio (Rachas) ---- */

/**
 * Calcula la racha basándose en el historial de partidas
 */
function calculateStreak(matches) {
  if (!matches || matches.length === 0) return 0;
  
  let streak = 0;
  const firstMatchWin = matches[0].win;
  
  for (let match of matches) {
    if (match.win === firstMatchWin) {
      streak += (firstMatchWin ? 1 : -1);
    } else {
      break;
    }
  }
  return streak;
}

/* ---- Auto-refresh ---- */
setInterval(() => {
  if (accounts.length === 0) return;
  accounts.forEach(acc => handleRefresh(acc.puuid, true));
}, AUTO_REFRESH_INTERVAL);

/* ---- Search ---- */
async function handleSearch() {
  const raw = searchInput.value.trim();
  showError('');
  if (!raw) return;

  const parts = raw.split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    showError('Formato invalido. Usa Nombre#TAG (ej: Pepitoflow#LAN1)');
    return;
  }

  const [gameName, tagLine] = parts;
  searchBtn.disabled = true;
  searchBtn.textContent = '...';

  try {
    const entry = await fetchAccountSnapshot(gameName, tagLine);
    
    // Calcular racha antes de añadir
    entry.streak = calculateStreak(entry.matches);
    
    const result = addAccount(accounts, entry);

    if (!result.added) {
      showError('Esta cuenta ya esta en la lista.');
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
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  }
}

/* ---- Refresh individual ---- */
async function handleRefresh(puuid, silent = false) {
  const acc = accounts.find(a => a.puuid === puuid);
  if (!acc) return;

  // Muestra spinner
  const card = document.getElementById(`card-${puuid}`);
  if (card) {
    const btn = card.querySelector('.refresh-btn');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
  }

  try {
    const updated = await fetchAccountSnapshot(acc.gameName, acc.tagLine);
    
    // Calcular racha en la actualización
    updated.streak = calculateStreak(updated.matches);
    
    accounts = accounts.map(a => a.puuid === puuid ? updated : a);
    saveAccounts(accounts);
    renderAccounts(accounts);
  } catch (err) {
    if (!silent) {
      const msg = err.status
        ? getApiErrorMessage(err.status)
        : `Error de red: ${err.message}`;
      showError(msg);
    }
    // Quita el spinner si fallo
    const card = document.getElementById(`card-${puuid}`);
    if (card) {
      const btn = card.querySelector('.refresh-btn');
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
  }
}

/* ---- Event delegation ---- */
accountsGrid.addEventListener('click', (e) => {
  const removeBtn  = e.target.closest('.remove-btn');
  const refreshBtn = e.target.closest('.refresh-btn');

  if (removeBtn) {
    const puuid = removeBtn.dataset.puuid;
    accounts = removeAccount(accounts, puuid);
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