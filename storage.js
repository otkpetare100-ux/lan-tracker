/**
 * storage.js — Persistent storage for LAN Tracker
 *
 * Wraps localStorage with a simple typed interface.
 * All account data is stored under a single key as a JSON array.
 */

const STORAGE_KEY = 'lol-lan-tracker-accounts';

/**
 * Loads all saved accounts from localStorage.
 * @returns {AccountEntry[]}
 */
function loadAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persists the current accounts array to localStorage.
 * @param {AccountEntry[]} accounts
 */
function saveAccounts(accounts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('[LAN Tracker] Could not save to localStorage:', e);
  }
}

/**
 * Adds a new account entry (if the puuid isn't already tracked).
 * @param {AccountEntry[]} accounts
 * @param {AccountEntry}   entry
 * @returns {{ accounts: AccountEntry[], added: boolean }}
 */
function addAccount(accounts, entry) {
  if (accounts.some(a => a.puuid === entry.puuid)) {
    return { accounts, added: false };
  }
  const updated = [...accounts, entry];
  saveAccounts(updated);
  return { accounts: updated, added: true };
}

/**
 * Removes an account by puuid.
 * @param {AccountEntry[]} accounts
 * @param {string}         puuid
 * @returns {AccountEntry[]}
 */
function removeAccount(accounts, puuid) {
  const updated = accounts.filter(a => a.puuid !== puuid);
  saveAccounts(updated);
  return updated;
}
