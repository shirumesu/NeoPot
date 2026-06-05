import { safeStorage } from 'electron'
import Store from 'electron-store'
import { writeFileSync } from 'node:fs'
import { runDataMigration } from './data-migration'
import { logger } from '../logger'
import {
  SecretEncryptionUnavailableError,
  decryptSensitiveConfigValue,
  encryptSensitiveConfigValue,
  isEncryptedSecretValue,
  secretKeyFragments,
  type SecretCipher,
} from './configSecrets'

type ConfigValue = unknown

export interface SecretWriteResult {
  status: 'ok' | 'unsupported'
  code?: 'SECRET_ENCRYPTION_UNAVAILABLE'
}

export interface SecretReadResult {
  status: 'ok' | 'missing' | 'unsupported' | 'failed'
  value?: string
  code?: 'SECRET_ENCRYPTION_UNAVAILABLE' | 'SECRET_DECRYPT_FAILED'
}

const secretKeys = new Set<string>(secretKeyFragments)

const store = new Store<Record<string, ConfigValue>>({
  name: 'config',
})

let migrationStarted = false
let configWriteQueue: Promise<void> = Promise.resolve()

const atomicWriteFallbackErrorCodes = new Set(['EPERM', 'EBUSY'])

const secretCipher: SecretCipher = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value),
}

export async function initializeConfig(): Promise<void> {
  if (migrationStarted) {
    return
  }

  migrationStarted = true
  await runDataMigration()
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return [...secretKeys].some((secretKey) => normalized.includes(secretKey))
}

export function getConfig(key: string): ConfigValue {
  return decryptSensitiveConfigValue(store.get(key), secretCipher)
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

function writeConfigValueDirectly(key: string, value: ConfigValue): void {
  const nextStore = store.store
  applyConfigValue(nextStore, key, encryptSensitiveConfigValue(value, secretCipher, [key]))
  writeFileSync(store.path, JSON.stringify(nextStore, undefined, '\t'), { mode: 0o600 })
  store.events.dispatchEvent(new Event('change'))
}

function writeConfigValue(key: string, value: ConfigValue): void {
  const persistedValue = encryptSensitiveConfigValue(value, secretCipher, [key])
  try {
    if (persistedValue === undefined) {
      store.delete(key)
    } else {
      store.set(key, persistedValue)
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
    writeConfigValueDirectly(key, value)
    logger.debug('Config value written in main process through direct fallback.', {
      key,
      ...describeConfigValue(value),
    })
  }
}

export function setConfig(key: string, value: ConfigValue): Promise<void> {
  const writeTask = configWriteQueue
    .catch(() => {
      // Keep later writes from being blocked by a previous failed write.
    })
    .then(() => writeConfigValue(key, value))

  configWriteQueue = writeTask.catch(() => {
    // The caller receives the failure from writeTask; the queue remains usable.
  })

  return writeTask
}

export function getRedactedConfig(key: string): ConfigValue {
  const value = getConfig(key)
  if (!isSecretKey(key) || value === undefined || value === null || value === '') {
    return value
  }

  return '********'
}

export function setSecret(key: string, plaintext: string): SecretWriteResult {
  try {
    const encrypted = encryptSensitiveConfigValue(plaintext, secretCipher, [key])
    store.set(key, encrypted)
    return { status: 'ok' }
  } catch (error) {
    if (!(error instanceof SecretEncryptionUnavailableError)) {
      throw error
    }

    store.set(`${key}.__secret_state`, {
      code: 'SECRET_ENCRYPTION_UNAVAILABLE',
    })
    return {
      status: 'unsupported',
      code: 'SECRET_ENCRYPTION_UNAVAILABLE',
    }
  }
}

export function getSecret(key: string): SecretReadResult {
  const state = store.get(`${key}.__secret_state`) as { code?: string } | undefined
  if (state?.code === 'SECRET_ENCRYPTION_UNAVAILABLE') {
    return {
      status: 'unsupported',
      code: 'SECRET_ENCRYPTION_UNAVAILABLE',
    }
  }

  const stored = store.get(key) as { encrypted?: string; encoding?: string } | unknown | undefined
  if (!stored) {
    return { status: 'missing' }
  }

  try {
    if (!isEncryptedSecretValue(stored) && !(stored as { encrypted?: string }).encrypted) {
      return { status: 'missing' }
    }
    const value = isEncryptedSecretValue(stored)
      ? String(decryptSensitiveConfigValue(stored, secretCipher))
      : safeStorage.decryptString(
          Buffer.from((stored as { encrypted?: string }).encrypted ?? '', 'base64'),
        )
    return {
      status: 'ok',
      value,
    }
  } catch {
    return {
      status: 'failed',
      code: 'SECRET_DECRYPT_FAILED',
    }
  }
}
