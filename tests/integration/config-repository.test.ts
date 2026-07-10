import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createConfigRepository,
  type ConfigStoreAdapter,
} from '../../src/main/modules/configRepository'
import type { SecretCipher } from '../../src/main/modules/configSecrets'

interface Deferred {
  promise: Promise<void>
  resolve(): void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function codedError(code: string) {
  return Object.assign(new Error(`write failed: ${code}`), { code })
}

class JsonConfigStore implements ConfigStoreAdapter {
  readonly operations: string[] = []
  changeEvents = 0
  state: Record<string, unknown> = {}
  private nextFailure: Error | null = null
  private nextDelay: Promise<void> | null = null

  constructor(readonly path: string) {}

  get(key: string) {
    return this.state[key]
  }

  async set(key: string, value: unknown) {
    this.operations.push(`set:${key}:start`)
    await this.consumeDelay()
    this.consumeFailure()
    this.state[key] = value
    await this.persist()
    this.operations.push(`set:${key}:finish`)
  }

  async delete(key: string) {
    this.operations.push(`delete:${key}:start`)
    await this.consumeDelay()
    this.consumeFailure()
    delete this.state[key]
    await this.persist()
    this.operations.push(`delete:${key}:finish`)
  }

  readAll() {
    return this.state
  }

  dispatchChange() {
    this.changeEvents += 1
  }

  failNext(code: string) {
    this.nextFailure = codedError(code)
  }

  delayNext(gate: Promise<void>) {
    this.nextDelay = gate
  }

  private async consumeDelay() {
    const delay = this.nextDelay
    this.nextDelay = null
    await delay
  }

  private consumeFailure() {
    const failure = this.nextFailure
    this.nextFailure = null
    if (failure) {
      throw failure
    }
  }

  private async persist() {
    await writeFile(this.path, JSON.stringify(this.state, null, 2), 'utf8')
  }
}

const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`sealed:${value}`, 'utf8'),
  decryptString: (value) => value.toString('utf8').replace(/^sealed:/u, ''),
}

let tempDir: string
let store: JsonConfigStore
let directWriteModes: number[]

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'neopot-config-test-'))
  store = new JsonConfigStore(path.join(tempDir, 'config.json'))
  directWriteModes = []
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

function repository() {
  return createConfigRepository({
    store,
    cipher,
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
    },
    writeFile: (file, data, options) => {
      directWriteModes.push(options.mode)
      return writeFile(file, data, options)
    },
  })
}

async function persistedConfig() {
  return JSON.parse(await readFile(store.path, 'utf8')) as Record<string, unknown>
}

describe('config repository', () => {
  test('persists writes and removes deleted keys from disk', async () => {
    const config = repository()

    await config.set('theme', 'dark')
    await config.set('server_port', 60828)
    expect(await persistedConfig()).toEqual({ theme: 'dark', server_port: 60828 })

    await config.set('theme', undefined)
    expect(await persistedConfig()).toEqual({ server_port: 60828 })
    expect(config.get('theme')).toBeUndefined()
  })

  test('encrypts sensitive leaves on disk and decrypts them for current consumers', async () => {
    const config = repository()
    const service = {
      instanceName: 'DeepL',
      authApi: { authKey: 'api-secret' },
      deeplx: { authKey: 'local-secret', customUrl: 'http://127.0.0.1:1188' },
    }

    await config.set('deepl@primary', service)
    await config.set('proxy_password', 'proxy-secret')

    const diskText = await readFile(store.path, 'utf8')
    expect(diskText).not.toContain('api-secret')
    expect(diskText).not.toContain('local-secret')
    expect(diskText).not.toContain('proxy-secret')
    expect(await persistedConfig()).toMatchObject({
      'deepl@primary': {
        authApi: { authKey: { __neopot_secret: true, version: 1 } },
        deeplx: { authKey: { __neopot_secret: true, version: 1 } },
      },
    })
    expect(config.get('deepl@primary')).toEqual(service)
    expect(config.get('proxy_password')).toBe('proxy-secret')
    expect(config.getRedacted('proxy_password')).toBe('********')
  })

  test.each(['EPERM', 'EBUSY'])('falls back to a private direct write for %s', async (code) => {
    const config = repository()
    store.failNext(code)

    await config.set('language', 'zh_CN')

    expect(await persistedConfig()).toEqual({ language: 'zh_CN' })
    expect(store.changeEvents).toBe(1)
    expect(directWriteModes).toEqual([0o600])
  })

  test('the direct fallback deletes a key instead of serializing undefined', async () => {
    const config = repository()
    await config.set('theme', 'dark')
    store.failNext('EBUSY')

    await config.set('theme', undefined)

    expect(await persistedConfig()).toEqual({})
    expect(config.get('theme')).toBeUndefined()
  })

  test('propagates non-retryable write failures without changing persisted data', async () => {
    const config = repository()
    await config.set('theme', 'light')
    store.failNext('EACCES')

    await expect(config.set('theme', 'dark')).rejects.toMatchObject({ code: 'EACCES' })
    expect(await persistedConfig()).toEqual({ theme: 'light' })
    expect(config.get('theme')).toBe('light')
  })

  test('serializes concurrent writes instead of starting a later write early', async () => {
    const config = repository()
    const gate = deferred()
    store.delayNext(gate.promise)

    const first = config.set('first', 1)
    const second = config.set('second', 2)
    await vi.waitFor(() => expect(store.operations).toEqual(['set:first:start']))

    gate.resolve()
    await Promise.all([first, second])

    expect(store.operations).toEqual([
      'set:first:start',
      'set:first:finish',
      'set:second:start',
      'set:second:finish',
    ])
    expect(await persistedConfig()).toEqual({ first: 1, second: 2 })
  })

  test('a failed write does not prevent the next queued write from persisting', async () => {
    const config = repository()
    store.failNext('EACCES')

    const failed = config.set('first', 1)
    const recovered = config.set('second', 2)

    await expect(failed).rejects.toMatchObject({ code: 'EACCES' })
    await expect(recovered).resolves.toBeUndefined()
    expect(await persistedConfig()).toEqual({ second: 2 })
  })
})
