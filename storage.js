/**
 * storage.js — Cuentas compartidas guardadas en el servidor
 */

const SERVER = window.location.origin;

async function loadAccounts() {
  try {
    const res  = await fetch(SERVER + '/accounts');
    if (!res.ok) return [];
    return await res.json();
  } catch(e) {
    console.warn('[Storage] Error cargando cuentas:', e);
    return [];
  }
}

async function saveAccountToServer(entry) {
  try {
    const res = await fetch(SERVER + '/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.status === 409) return { added: false };
    if (!res.ok) return { added: false };
    return { added: true };
  } catch(e) {
    console.warn('[Storage] Error guardando cuenta:', e);
    return { added: false };
  }
}

async function deleteAccountFromServer(puuid) {
  try {
    await fetch(SERVER + '/accounts/' + puuid, { method: 'DELETE' });
  } catch(e) {
    console.warn('[Storage] Error eliminando cuenta:', e);
  }
}

async function updateAccountOnServer(entry) {
  try {
    await fetch(SERVER + '/accounts/' + entry.puuid, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch(e) {
    console.warn('[Storage] Error actualizando cuenta:', e);
  }
}
