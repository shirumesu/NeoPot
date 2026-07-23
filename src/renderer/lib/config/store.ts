import { logger } from '@/renderer/lib/logger'

type StoreKey = string
type StoreValue = unknown

export const STORE_RELOADED_EVENT = 'neopot:store-reloaded'
export const STORE_CHANGED_EVENT = 'neopot:store-changed'
export const CONFIG_CHANGED_APP_EVENT = 'config:changed'

let unsubscribeElectronConfigChanged: (() => void) | null = null
let cacheRevision = 0
const keyCacheRevisions = new Map<StoreKey, number>()
const valueCache = new Map<StoreKey, StoreValue | undefined>()
const inFlightReads = new Map<StoreKey, Promise<StoreValue | undefined>>()

const cloneStoreValue = <T extends StoreValue | undefined>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }
  return structuredClone(value)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const emitStoreEvent = (eventName: string, detail: Record<string, unknown> = {}) => {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

export const emitStoreReloaded = () => {
  cacheRevision += 1
  keyCacheRevisions.clear()
  valueCache.clear()
  inFlightReads.clear()
  emitStoreEvent(STORE_RELOADED_EVENT)
}

export const emitStoreValueChanged = (key: StoreKey, value: StoreValue) => {
  keyCacheRevisions.set(key, (keyCacheRevisions.get(key) ?? 0) + 1)
  inFlightReads.delete(key)
  valueCache.set(key, cloneStoreValue(value))
  emitStoreEvent(STORE_CHANGED_EVENT, { key, value })
}

export const emitStoreValueReloaded = (key: StoreKey) => {
  keyCacheRevisions.set(key, (keyCacheRevisions.get(key) ?? 0) + 1)
  inFlightReads.delete(key)
  valueCache.delete(key)
  emitStoreEvent(STORE_CHANGED_EVENT, { key })
}

function subscribeElectronConfigChanges(): void {
  if (unsubscribeElectronConfigChanged) {
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

async function readStoreValue(key: StoreKey): Promise<StoreValue | undefined> {
  return (await window.neoPot.config.get(key)) ?? undefined
}

export async function getStoreValue(key: StoreKey): Promise<StoreValue | undefined> {
  if (valueCache.has(key)) {
    return cloneStoreValue(valueCache.get(key))
  }

  const existingRead = inFlightReads.get(key)
  if (existingRead) {
    return cloneStoreValue(await existingRead)
  }

  const readRevision = cacheRevision
  const keyRevision = keyCacheRevisions.get(key) ?? 0
  const readPromise = readStoreValue(key).then((value) => {
    if (cacheRevision === readRevision && (keyCacheRevisions.get(key) ?? 0) === keyRevision) {
      valueCache.set(key, cloneStoreValue(value))
    }
    return value
  })
  inFlightReads.set(key, readPromise)

  try {
    return cloneStoreValue(await readPromise)
  } finally {
    if (inFlightReads.get(key) === readPromise) {
      inFlightReads.delete(key)
    }
  }
}

export async function setStoreValue(key: StoreKey, value: StoreValue): Promise<void> {
  await window.neoPot.config.set(key, value)
  logger.debug('Config value written through Electron config API.', { key })
  emitStoreValueChanged(key, value)
}

export async function hasStoreValue(key: StoreKey): Promise<boolean> {
  return (await getStoreValue(key)) !== undefined
}

export async function deleteStoreValue(key: StoreKey): Promise<boolean> {
  const existed = (await getStoreValue(key)) !== undefined
  await window.neoPot.config.set(key, undefined)
  emitStoreValueChanged(key, undefined)
  return existed
}

export async function initStore(): Promise<void> {
  emitStoreReloaded()
  subscribeElectronConfigChanges()
}
