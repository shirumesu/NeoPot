import { LazyStore } from '@/renderer/lib/electron/compat/store'
import { appConfigDir, join } from '@/renderer/lib/electron/compat/path'
import { watch } from '@/renderer/lib/electron/compat/fs'
import { logger } from '@/renderer/lib/logger'
import { electronCommand } from '../electron/command'

type StoreKey = string
type StoreValue = unknown

interface SetStoreValueOptions {
  save?: boolean
}

export let store: LazyStore | null = null
export const STORE_RELOADED_EVENT = 'pot:store-reloaded'
export const STORE_CHANGED_EVENT = 'pot:store-changed'
export const CONFIG_CHANGED_APP_EVENT = 'config:changed'

let ignoreWatchEventsUntil = 0
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let saveQueue = Promise.resolve()
let unsubscribeElectronConfigChanged: (() => void) | null = null

const getElectronConfigApi = () => window.neoPot?.config ?? null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const emitStoreEvent = (eventName: string, detail: Record<string, unknown> = {}) => {
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
    }),
  )
}

export const emitStoreReloaded = () => {
  emitStoreEvent(STORE_RELOADED_EVENT)
}

export const emitStoreValueChanged = (key: StoreKey, value: StoreValue) => {
  emitStoreEvent(STORE_CHANGED_EVENT, {
    key,
    value,
  })
}

export const emitStoreValueReloaded = (key: StoreKey) => {
  emitStoreEvent(STORE_CHANGED_EVENT, {
    key,
  })
}

function subscribeElectronConfigChanges(): void {
  if (unsubscribeElectronConfigChanged || !window.neoPot?.app.onEvent) {
    return
  }

  unsubscribeElectronConfigChanged = window.neoPot.app.onEvent(
    CONFIG_CHANGED_APP_EVENT,
    (payload) => {
      if (!isRecord(payload) || typeof payload.key !== 'string') {
        logger.warn('Ignored malformed config change event from main process.')
        return
      }

      emitStoreValueReloaded(payload.key)
      logger.info('Config change received from main process.', {
        key: payload.key,
      })
    },
  )
}

export async function getStoreValue(key: StoreKey): Promise<StoreValue | undefined> {
  const electronConfig = getElectronConfigApi()
  if (electronConfig) {
    return (await electronConfig.get(key)) ?? undefined
  }

  if (!store) {
    return undefined
  }

  const value = await store.get(key)
  return value
}

export async function saveStore(): Promise<void> {
  if (getElectronConfigApi()) {
    return
  }

  if (!store) {
    return
  }

  const currentStore = store
  ignoreWatchEventsUntil = Date.now() + 500
  saveQueue = saveQueue
    .catch(() => {
      // Keep the queue recoverable after a previous save failure.
    })
    .then(async () => {
      await currentStore.save()
      logger.debug('Config store saved.')
    })

  await saveQueue
}

export async function reloadStoreFromDisk(): Promise<void> {
  if (getElectronConfigApi()) {
    emitStoreReloaded()
    return
  }

  if (!store) {
    return
  }

  await store.reload({ ignoreDefaults: true })
  emitStoreReloaded()
  await electronCommand('reload_store')
}

export async function setStoreValue(
  key: StoreKey,
  value: StoreValue,
  options: SetStoreValueOptions = {},
): Promise<void> {
  const { save = true } = options
  const electronConfig = getElectronConfigApi()
  if (electronConfig) {
    await electronConfig.set(key, value)
    logger.debug('Config value written through Electron config API.', {
      key,
    })
    emitStoreValueChanged(key, value)
    return
  }

  if (!store) {
    return
  }

  await store.set(key, value)
  logger.debug('Config value written to renderer store.', {
    key,
    save,
  })

  if (save) {
    await saveStore()
  }

  emitStoreValueChanged(key, value)
}

export async function hasStoreValue(key: StoreKey): Promise<boolean> {
  if (getElectronConfigApi()) {
    return (await getStoreValue(key)) !== undefined
  }

  if (!store) {
    return false
  }

  return await store.has(key)
}

export async function deleteStoreValue(
  key: StoreKey,
  options: SetStoreValueOptions = {},
): Promise<boolean> {
  const { save = true } = options
  const electronConfig = getElectronConfigApi()
  if (electronConfig) {
    const existed = (await getStoreValue(key)) !== undefined
    await electronConfig.set(key, undefined)
    emitStoreValueChanged(key, undefined)
    return existed
  }

  if (!store) {
    return false
  }

  if (!(await store.has(key))) {
    return false
  }

  await store.delete(key)

  if (save) {
    await saveStore()
  }

  return true
}

export async function initStore(): Promise<void> {
  subscribeElectronConfigChanges()

  if (getElectronConfigApi()) {
    store = null
    return
  }

  const appConfigDirPath = await appConfigDir()
  const appConfigPath = await join(appConfigDirPath, 'config.json')
  store = new LazyStore(appConfigPath)
  await store.init()
  await store.reload({ ignoreDefaults: true })

  await watch(appConfigPath, async () => {
    if (Date.now() < ignoreWatchEventsUntil) {
      return
    }

    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    reloadTimer = setTimeout(async () => {
      try {
        if (!store) {
          return
        }
        await reloadStoreFromDisk()
      } catch (error) {
        logger.error('Failed to reload store after file watch event.', error)
      }
    }, 150)
  })
}
