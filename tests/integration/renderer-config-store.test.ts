// @vitest-environment jsdom

import type { NeoPotElectronApi } from '../../src/shared/types/electron-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const localStoreMock = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  const instance = {
    init: vi.fn(),
    reload: vi.fn(),
    get: vi.fn((key: string) => Promise.resolve(values.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value)
      return Promise.resolve()
    }),
    has: vi.fn((key: string) => Promise.resolve(values.has(key))),
    delete: vi.fn((key: string) => {
      values.delete(key)
      return Promise.resolve()
    }),
    save: vi.fn(),
  }
  const LazyStore = vi.fn(function LazyStore() {
    return instance
  })
  return { instance, LazyStore, values }
})

const compatMock = vi.hoisted(() => ({
  appConfigDir: vi.fn(),
  join: vi.fn(),
  watch: vi.fn(),
  watchCallback: undefined as (() => Promise<void>) | undefined,
  electronCommand: vi.fn(),
}))

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/renderer/lib/electron/compat/store', () => ({
  LazyStore: localStoreMock.LazyStore,
}))
vi.mock('@/renderer/lib/electron/compat/path', () => ({
  appConfigDir: compatMock.appConfigDir,
  join: compatMock.join,
}))
vi.mock('@/renderer/lib/electron/compat/fs', () => ({
  watch: compatMock.watch,
}))
vi.mock('@/renderer/lib/electron/command', () => ({
  electronCommand: compatMock.electronCommand,
}))
vi.mock('@/renderer/lib/logger', () => ({
  logger: loggerMock,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  localStoreMock.values.clear()
  localStoreMock.instance.init.mockResolvedValue(undefined)
  localStoreMock.instance.reload.mockResolvedValue(undefined)
  localStoreMock.instance.save.mockResolvedValue(undefined)
  compatMock.appConfigDir.mockResolvedValue('C:/NeoPot')
  compatMock.join.mockResolvedValue('C:/NeoPot/config.json')
  compatMock.electronCommand.mockResolvedValue(undefined)
  compatMock.watchCallback = undefined
  compatMock.watch.mockImplementation(async (_path: string, callback: () => Promise<void>) => {
    compatMock.watchCallback = callback
  })
  Object.defineProperty(window, 'neoPot', {
    configurable: true,
    value: undefined,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadConfigStore() {
  return import('../../src/renderer/lib/config/store')
}

function installElectronConfig() {
  const values = new Map<string, unknown>()
  let configChangeListener: ((payload: unknown) => void) | undefined
  const unsubscribe = vi.fn()
  const config = {
    get: vi.fn((key: string) => Promise.resolve(values.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      if (value === undefined) {
        values.delete(key)
      } else {
        values.set(key, value)
      }
      return Promise.resolve()
    }),
  }
  const onEvent = vi.fn((event: string, listener: (payload: unknown) => void) => {
    if (event === 'config:changed') {
      configChangeListener = listener
    }
    return unsubscribe
  })

  Object.defineProperty(window, 'neoPot', {
    configurable: true,
    value: {
      app: { onEvent },
      config,
    } as unknown as NeoPotElectronApi,
  })

  return {
    config,
    emitConfigChange: (payload: unknown) => configChangeListener?.(payload),
    onEvent,
    values,
  }
}

describe('renderer config store through Electron', () => {
  it('reads, writes, deletes, and emits observable value changes through the preload API', async () => {
    const electron = installElectronConfig()
    electron.values.set('theme', 'light')
    const configStore = await loadConfigStore()
    const events: Array<{ key: string; value?: unknown }> = []
    window.addEventListener(configStore.STORE_CHANGED_EVENT, (event) => {
      events.push((event as CustomEvent<{ key: string; value?: unknown }>).detail)
    })

    await configStore.initStore()
    expect(configStore.store).toBeNull()
    expect(await configStore.getStoreValue('theme')).toBe('light')
    expect(await configStore.hasStoreValue('theme')).toBe(true)

    await configStore.setStoreValue('theme', 'dark')
    expect(electron.config.set).toHaveBeenCalledWith('theme', 'dark')
    expect(events).toContainEqual({ key: 'theme', value: 'dark' })

    expect(await configStore.deleteStoreValue('theme')).toBe(true)
    expect(electron.config.set).toHaveBeenLastCalledWith('theme', undefined)
    expect(events).toContainEqual({ key: 'theme', value: undefined })
    expect(await configStore.hasStoreValue('theme')).toBe(false)
  })

  it('subscribes once and converts valid Main config events into key-only reload events', async () => {
    const electron = installElectronConfig()
    const configStore = await loadConfigStore()
    const events: Array<Record<string, unknown>> = []
    window.addEventListener(configStore.STORE_CHANGED_EVENT, (event) => {
      events.push((event as CustomEvent<Record<string, unknown>>).detail)
    })

    await configStore.initStore()
    await configStore.initStore()
    electron.emitConfigChange({ key: 'proxy' })
    electron.emitConfigChange({ key: 42 })
    electron.emitConfigChange('invalid')

    expect(electron.onEvent).toHaveBeenCalledOnce()
    expect(electron.onEvent).toHaveBeenCalledWith('config:changed', expect.any(Function))
    expect(events).toEqual([{ key: 'proxy' }])
    expect(loggerMock.warn).toHaveBeenCalledTimes(2)
  })

  it('reloads observers without touching the legacy renderer store', async () => {
    installElectronConfig()
    const configStore = await loadConfigStore()
    const reloaded = vi.fn()
    window.addEventListener(configStore.STORE_RELOADED_EVENT, reloaded)

    await configStore.reloadStoreFromDisk()

    expect(reloaded).toHaveBeenCalledOnce()
    expect(localStoreMock.instance.reload).not.toHaveBeenCalled()
    expect(compatMock.electronCommand).not.toHaveBeenCalled()
  })
})

describe('renderer config store fallback', () => {
  it('initializes the local store and respects save and no-save writes', async () => {
    const configStore = await loadConfigStore()

    await configStore.initStore()
    await configStore.setStoreValue('draft', { enabled: true }, { save: false })
    await configStore.setStoreValue('committed', 2)

    expect(compatMock.appConfigDir).toHaveBeenCalledOnce()
    expect(compatMock.join).toHaveBeenCalledWith('C:/NeoPot', 'config.json')
    expect(localStoreMock.LazyStore).toHaveBeenCalledWith('C:/NeoPot/config.json')
    expect(localStoreMock.instance.init).toHaveBeenCalledOnce()
    expect(localStoreMock.instance.reload).toHaveBeenCalledWith({ ignoreDefaults: true })
    expect(localStoreMock.instance.set).toHaveBeenNthCalledWith(1, 'draft', { enabled: true })
    expect(localStoreMock.instance.set).toHaveBeenNthCalledWith(2, 'committed', 2)
    expect(localStoreMock.instance.save).toHaveBeenCalledOnce()
  })

  it('recovers the serialized save queue after a previous save failure', async () => {
    const configStore = await loadConfigStore()
    await configStore.initStore()
    localStoreMock.instance.save
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(undefined)

    await expect(configStore.setStoreValue('first', 1)).rejects.toThrow('disk unavailable')
    await expect(configStore.setStoreValue('second', 2)).resolves.toBeUndefined()

    expect(localStoreMock.instance.save).toHaveBeenCalledTimes(2)
    expect(await configStore.getStoreValue('second')).toBe(2)
  })

  it('ignores self-generated watch events and reloads later external file changes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T00:00:00Z'))
    const configStore = await loadConfigStore()
    const reloaded = vi.fn()
    window.addEventListener(configStore.STORE_RELOADED_EVENT, reloaded)
    await configStore.initStore()
    await configStore.setStoreValue('theme', 'dark')
    localStoreMock.instance.reload.mockClear()

    await compatMock.watchCallback?.()
    await vi.advanceTimersByTimeAsync(200)
    expect(localStoreMock.instance.reload).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)
    await compatMock.watchCallback?.()
    await vi.advanceTimersByTimeAsync(150)

    expect(localStoreMock.instance.reload).toHaveBeenCalledWith({ ignoreDefaults: true })
    expect(compatMock.electronCommand).toHaveBeenCalledWith('reload_store')
    expect(reloaded).toHaveBeenCalledOnce()
  })

  it('does not delete or save a missing key, but persists an existing deletion', async () => {
    const configStore = await loadConfigStore()
    await configStore.initStore()

    expect(await configStore.deleteStoreValue('missing')).toBe(false)
    expect(localStoreMock.instance.delete).not.toHaveBeenCalled()
    expect(localStoreMock.instance.save).not.toHaveBeenCalled()

    localStoreMock.values.set('present', true)
    expect(await configStore.deleteStoreValue('present')).toBe(true)
    expect(localStoreMock.instance.delete).toHaveBeenCalledWith('present')
    expect(localStoreMock.instance.save).toHaveBeenCalledOnce()
  })
})
