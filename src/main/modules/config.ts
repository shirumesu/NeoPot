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
  type SecretCipher,
} from './configSecrets'
import { createConfigRepository } from './configRepository'

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

const store = new Store<Record<string, ConfigValue>>({
  name: 'config',
})

let migrationStarted = false

const secretCipher: SecretCipher = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value),
}

const configRepository = createConfigRepository({
  store: {
    path: store.path,
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
    readAll: () => store.store,
    dispatchChange: () => store.events.dispatchEvent(new Event('change')),
  },
  cipher: secretCipher,
  logger,
  writeFile: (file, data, options) => writeFileSync(file, data, options),
})

export async function initializeConfig(): Promise<void> {
  if (migrationStarted) {
    return
  }

  migrationStarted = true
  await runDataMigration()
}

export function getConfig(key: string): ConfigValue {
  return configRepository.get(key)
}

export function setConfig(key: string, value: ConfigValue): Promise<void> {
  return configRepository.set(key, value)
}

export function getRedactedConfig(key: string): ConfigValue {
  return configRepository.getRedacted(key)
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
