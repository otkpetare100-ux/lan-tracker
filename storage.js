/**
 * storage.js — Manejo de persistencia y API local
 */

async function loadAccounts() {
    try {
        // Usamos ruta relativa para que Railway sepa que es el mismo servidor
        const response = await fetch('/accounts');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('Cuentas cargadas desde el servidor:', data);
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
        return await response.json();
    } catch (err) {
        console.error('[Storage] Error al guardar:', err);
    }
}

async function deleteAccount(puuid) {
    try {
        await fetch(`/accounts/${puuid}`, { method: 'DELETE' });
    } catch (err) {
        console.error('[Storage] Error al eliminar:', err);
    }
}

window.loadAccounts = loadAccounts;
window.saveAccount = saveAccount;
window.deleteAccount = deleteAccount;