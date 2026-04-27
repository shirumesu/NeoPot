import { LazyStore } from '@tauri-apps/plugin-store';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { watch } from '@tauri-apps/plugin-fs';
import { tauriCommand } from './tauri_adapter';

type StoreKey = string;
type StoreValue = unknown;

interface SetStoreValueOptions {
    save?: boolean;
}

export let store: LazyStore | null = null;
export const STORE_RELOADED_EVENT = 'pot:store-reloaded';
export const STORE_CHANGED_EVENT = 'pot:store-changed';

let ignoreWatchEventsUntil = 0;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let saveQueue = Promise.resolve();

const emitStoreEvent = (eventName: string, detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(
        new CustomEvent(eventName, {
            detail,
        })
    );
};

export const emitStoreReloaded = () => {
    emitStoreEvent(STORE_RELOADED_EVENT);
};

export const emitStoreValueChanged = (key: StoreKey, value: StoreValue) => {
    emitStoreEvent(STORE_CHANGED_EVENT, {
        key,
        value,
    });
};

export async function getStoreValue(key: StoreKey): Promise<StoreValue | undefined> {
    if (!store) {
        return undefined;
    }

    const value = await store.get(key);
    return value;
}

export async function saveStore(): Promise<void> {
    if (!store) {
        return;
    }

    const currentStore = store;
    ignoreWatchEventsUntil = Date.now() + 500;
    saveQueue = saveQueue
        .catch(() => {
            // Keep the queue recoverable after a previous save failure.
        })
        .then(async () => {
            await currentStore.save();
        });

    await saveQueue;
}

export async function reloadStoreFromDisk(): Promise<void> {
    if (!store) {
        return;
    }

    await store.reload({ ignoreDefaults: true });
    emitStoreReloaded();
    await tauriCommand('reload_store');
}

export async function setStoreValue(
    key: StoreKey,
    value: StoreValue,
    options: SetStoreValueOptions = {}
): Promise<void> {
    const { save = true } = options;

    if (!store) {
        return;
    }

    await store.set(key, value);

    if (save) {
        await saveStore();
    }
}

export async function hasStoreValue(key: StoreKey): Promise<boolean> {
    if (!store) {
        return false;
    }

    return await store.has(key);
}

export async function deleteStoreValue(key: StoreKey, options: SetStoreValueOptions = {}): Promise<boolean> {
    const { save = true } = options;

    if (!store) {
        return false;
    }

    if (!(await store.has(key))) {
        return false;
    }

    await store.delete(key);

    if (save) {
        await saveStore();
    }

    return true;
}

export async function initStore(): Promise<void> {
    const appConfigDirPath = await appConfigDir();
    const appConfigPath = await join(appConfigDirPath, 'config.json');
    store = new LazyStore(appConfigPath);
    await store.init();
    await store.reload({ ignoreDefaults: true });

    await watch(appConfigPath, async () => {
        if (Date.now() < ignoreWatchEventsUntil) {
            return;
        }

        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(async () => {
            try {
                if (!store) {
                    return;
                }
                await reloadStoreFromDisk();
            } catch (error) {
                console.error('Failed to reload store after file watch event:', error);
            }
        }, 150);
    });
}
