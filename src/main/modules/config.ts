import { safeStorage } from 'electron';
import Store from 'electron-store';
import { runDataMigration } from './data-migration';

type ConfigValue = unknown;

export interface SecretWriteResult {
    status: 'ok' | 'unsupported';
    code?: 'SECRET_ENCRYPTION_UNAVAILABLE';
}

export interface SecretReadResult {
    status: 'ok' | 'missing' | 'unsupported' | 'failed';
    value?: string;
    code?: 'SECRET_ENCRYPTION_UNAVAILABLE' | 'SECRET_DECRYPT_FAILED';
}

const secretKeys = new Set<string>([
    'api_key',
    'secret_key',
    'access_token',
    'refresh_token',
    'password',
    'token',
]);

const store = new Store<Record<string, ConfigValue>>({
    name: 'config',
});

let migrationStarted = false;

export async function initializeConfig(): Promise<void> {
    if (migrationStarted) {
        return;
    }

    migrationStarted = true;
    await runDataMigration();
}

function isSecretKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return [...secretKeys].some((secretKey) => normalized.includes(secretKey));
}

export function getConfig(key: string): ConfigValue {
    return store.get(key);
}

export function setConfig(key: string, value: ConfigValue): void {
    store.set(key, value);
}

export function getRedactedConfig(key: string): ConfigValue {
    const value = getConfig(key);
    if (!isSecretKey(key) || value === undefined || value === null || value === '') {
        return value;
    }

    return '********';
}

export function setSecret(key: string, plaintext: string): SecretWriteResult {
    if (!safeStorage.isEncryptionAvailable()) {
        store.set(`${key}.__secret_state`, {
            code: 'SECRET_ENCRYPTION_UNAVAILABLE',
        });
        return {
            status: 'unsupported',
            code: 'SECRET_ENCRYPTION_UNAVAILABLE',
        };
    }

    const encrypted = safeStorage.encryptString(plaintext).toString('base64');
    store.set(key, {
        encrypted,
        encoding: 'base64',
    });

    return { status: 'ok' };
}

export function getSecret(key: string): SecretReadResult {
    const state = store.get(`${key}.__secret_state`) as { code?: string } | undefined;
    if (state?.code === 'SECRET_ENCRYPTION_UNAVAILABLE') {
        return {
            status: 'unsupported',
            code: 'SECRET_ENCRYPTION_UNAVAILABLE',
        };
    }

    const stored = store.get(key) as { encrypted?: string; encoding?: string } | undefined;
    if (!stored?.encrypted) {
        return { status: 'missing' };
    }

    try {
        const value = safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64'));
        return {
            status: 'ok',
            value,
        };
    } catch {
        return {
            status: 'failed',
            code: 'SECRET_DECRYPT_FAILED',
        };
    }
}
