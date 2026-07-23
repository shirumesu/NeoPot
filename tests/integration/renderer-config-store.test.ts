// @vitest-environment jsdom

import type { NeoPotElectronApi } from '../../src/shared/types/electron-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/renderer/lib/logger', () => ({
  logger: loggerMock,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
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

  it('shares in-flight reads, caches resolved values, and invalidates a changed key', async () => {
    const electron = installElectronConfig()
    const configStore = await loadConfigStore()
    let resolveInitialRead: ((value: unknown) => void) | undefined
    electron.config.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialRead = resolve
        }),
    )
    await configStore.initStore()

    const firstRead = configStore.getStoreValue('theme')
    const secondRead = configStore.getStoreValue('theme')
    expect(electron.config.get).toHaveBeenCalledOnce()

    resolveInitialRead?.({ mode: 'light' })
    const initialValues = await Promise.all([firstRead, secondRead])
    expect(initialValues).toEqual([{ mode: 'light' }, { mode: 'light' }])
    ;(initialValues[0] as { mode: string }).mode = 'mutated'
    await expect(configStore.getStoreValue('theme')).resolves.toEqual({ mode: 'light' })
    expect(electron.config.get).toHaveBeenCalledOnce()

    electron.values.set('theme', { mode: 'dark' })
    electron.emitConfigChange({ key: 'theme' })
    await expect(configStore.getStoreValue('theme')).resolves.toEqual({ mode: 'dark' })
    expect(electron.config.get).toHaveBeenCalledTimes(2)
  })
})
