import type { AppLogger } from '../../shared/logger'
import {
  decryptSensitiveConfigValue,
  encryptSensitiveConfigValue,
  isSecretPath,
  type SecretCipher,
} from './configSecrets'

type ConfigValue = unknown

export interface ConfigStoreAdapter {
  readonly path: string
  get(key: string): ConfigValue
  set(key: string, value: ConfigValue): Promise<void> | void
  delete(key: string): Promise<void> | void
  readAll(): Record<string, ConfigValue>
  dispatchChange(): void
}

interface DirectWriteOptions {
  mode: number
}

interface CreateConfigRepositoryOptions {
  store: ConfigStoreAdapter
  cipher: SecretCipher
  logger: Pick<AppLogger, 'debug' | 'warn'>
  writeFile(file: string, data: string, options: DirectWriteOptions): Promise<void> | void
}

export interface ConfigRepository {
  get(key: string): ConfigValue
  set(key: string, value: ConfigValue): Promise<void>
  getRedacted(key: string): ConfigValue
}

const atomicWriteFallbackErrorCodes = new Set(['EPERM', 'EBUSY'])

function isSecretKey(key: string): boolean {
  return isSecretPath([key])
}

function getErrorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function describeConfigValue(value: ConfigValue): Record<string, unknown> {
  return {
    valueType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
  }
}

function applyConfigValue(
  targetStore: Record<string, ConfigValue>,
  key: string,
  value: ConfigValue,
): void {
  if (value === undefined) {
    delete targetStore[key]
    return
  }

  targetStore[key] = value
}

export function createConfigRepository({
  store,
  cipher,
  logger,
  writeFile,
}: CreateConfigRepositoryOptions): ConfigRepository {
  let writeQueue: Promise<void> = Promise.resolve()

  async function writeConfigValueDirectly(key: string, value: ConfigValue): Promise<void> {
    const nextStore = store.readAll()
    applyConfigValue(nextStore, key, encryptSensitiveConfigValue(value, cipher, [key]))
    await writeFile(store.path, JSON.stringify(nextStore, undefined, '\t'), { mode: 0o600 })
    store.dispatchChange()
  }

  async function writeConfigValue(key: string, value: ConfigValue): Promise<void> {
    const persistedValue = encryptSensitiveConfigValue(value, cipher, [key])
    try {
      if (persistedValue === undefined) {
        await store.delete(key)
      } else {
        await store.set(key, persistedValue)
      }
      logger.debug('Config value written in main process.', {
        key,
        ...describeConfigValue(value),
      })
    } catch (error) {
      const code = getErrorCode(error)
      if (!code || !atomicWriteFallbackErrorCodes.has(code)) {
        throw error
      }

      logger.warn('Config atomic write failed; falling back to direct config write.', {
        key,
        code,
      })
      await writeConfigValueDirectly(key, value)
      logger.debug('Config value written in main process through direct fallback.', {
        key,
        ...describeConfigValue(value),
      })
    }
  }

  function get(key: string): ConfigValue {
    return decryptSensitiveConfigValue(store.get(key), cipher)
  }

  function set(key: string, value: ConfigValue): Promise<void> {
    const writeTask = writeQueue
      .catch(() => {
        // Keep later writes from being blocked by a previous failed write.
      })
      .then(() => writeConfigValue(key, value))

    writeQueue = writeTask.catch(() => {
      // The caller receives the failure from writeTask; the queue remains usable.
    })

    return writeTask
  }

  function getRedacted(key: string): ConfigValue {
    const value = get(key)
    if (!isSecretKey(key) || value === undefined || value === null || value === '') {
      return value
    }

    return '********'
  }

  return { get, set, getRedacted }
}
