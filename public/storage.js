/**
 * storage.js — Manejo de persistencia y API local
 */

async function loadAccounts() {
    try {
        const response = await fetch('/accounts');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        return data;
    } catch (err) {
        console.error('[Storage] Error cargando cuentas:', err);
        return [];
    }
}
    

async function saveAccount(accountData) {
    try {
        const response = await fetch('/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountData)
        });
        const result = await response.json();
        return { ...result, added: response.ok };
    } catch (err) {
        console.error('[Storage] Error al guardar:', err);
        return { added: false, error: err.message };
    }
}

async function updateAccount(accountData) {
    try {
        const response = await fetch(`/accounts/${accountData.puuid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountData)
        });
        return response.ok;
    } catch (err) {
        console.error('[Storage] Error al actualizar:', err);
        return false;
    }
}

async function deleteAccount(puuid) {
    try {
        const response = await fetch(`/accounts/${puuid}`, { method: 'DELETE' });
        return response.ok;
    } catch (err) {
        console.error('[Storage] Error al eliminar:', err);
        return false;
    }
}

window.loadAccounts = loadAccounts;
window.saveAccount = saveAccount;
window.updateAccount = updateAccount;
window.deleteAccount = deleteAccount;

async function postRankHistory(entry) {
    try {
        const response = await fetch('/rank-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
        return response.ok;
    } catch (err) {
        console.error('[Storage] Error guardando historial de rango:', err);
        return false;
    }
}

async function getRankHistory(puuid) {
    try {
        const response = await fetch(`/rank-history/${puuid}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (err) {
        console.error('[Storage] Error cargando historial de rango:', err);
        return [];
    }
}

window.postRankHistory = postRankHistory;
window.getRankHistory = getRankHistory;