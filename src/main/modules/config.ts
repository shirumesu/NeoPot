import { safeStorage } from 'electron'
import Store from 'electron-store'
import { writeFileSync } from 'node:fs'
import { runDataMigration } from './data-migration'
import { logger } from '../logger'
import { type SecretCipher } from './configSecrets'
import { createConfigRepository } from './configRepository'

type ConfigValue = unknown

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
