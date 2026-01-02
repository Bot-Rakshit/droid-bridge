/**
 * Account Storage Manager
 * 
 * Manages provider accounts for Antigravity and Codex subscriptions.
 * Accounts are stored in ~/.droid-bridge/accounts.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AccountStorage, ProviderAccount, Provider } from "./types.js";

const CONFIG_DIR = path.join(os.homedir(), ".droid-bridge");
const ACCOUNTS_FILE = path.join(CONFIG_DIR, "accounts.json");

/**
 * Ensure config directory exists.
 */
function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * Load accounts from storage.
 */
export function loadAccounts(): AccountStorage {
    ensureConfigDir();

    if (!fs.existsSync(ACCOUNTS_FILE)) {
        return { version: 1, accounts: [] };
    }

    try {
        const data = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
        return JSON.parse(data) as AccountStorage;
    } catch {
        console.error("⚠️ Failed to load accounts, starting fresh");
        return { version: 1, accounts: [] };
    }
}

/**
 * Save accounts to storage.
 */
export function saveAccounts(storage: AccountStorage): void {
    ensureConfigDir();
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(storage, null, 2));
}

/**
 * Add or update an account.
 */
export function upsertAccount(account: ProviderAccount): void {
    const storage = loadAccounts();
    const index = storage.accounts.findIndex(a => a.id === account.id);

    if (index >= 0) {
        storage.accounts[index] = account;
    } else {
        storage.accounts.push(account);
    }

    saveAccounts(storage);
}

/**
 * Get accounts by provider.
 */
export function getAccountsByProvider(provider: Provider): ProviderAccount[] {
    const storage = loadAccounts();
    return storage.accounts.filter(a => a.provider === provider && a.isActive);
}

/**
 * Remove an account.
 */
export function removeAccount(accountId: string): boolean {
    const storage = loadAccounts();
    const index = storage.accounts.findIndex(a => a.id === accountId);

    if (index >= 0) {
        storage.accounts.splice(index, 1);
        saveAccounts(storage);
        return true;
    }
    return false;
}

/**
 * List all accounts (for display).
 */
export function listAccounts(): Array<{
    id: string;
    provider: Provider;
    email: string;
    isActive: boolean;
    lastUsed?: number;
}> {
    const storage = loadAccounts();
    return storage.accounts.map(a => ({
        id: a.id,
        provider: a.provider,
        email: a.email,
        isActive: a.isActive,
        lastUsed: a.lastUsed,
    }));
}

/**
 * Get config directory path.
 */
export function getConfigDir(): string {
    return CONFIG_DIR;
}
