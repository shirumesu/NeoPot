import type { NeoPotElectronApi, UpdateEvent } from '../../src/shared/types/electron-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type IpcListener = (event: unknown, payload: unknown) => void

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: electronMock.on,
    removeListener: electronMock.removeListener,
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadPreload(protocol: string, hostname: string) {
  vi.stubGlobal('location', { protocol, hostname })
  return import('../../src/preload/index')
}

function exposedApi(): NeoPotElectronApi {
  const call = electronMock.exposeInMainWorld.mock.calls.at(-1)
  if (!call) {
    throw new Error('Preload did not expose an API')
  }

  expect(call[0]).toBe('neoPot')
  return call[1] as NeoPotElectronApi
}

function listenerFor(channel: string): IpcListener {
  const call = electronMock.on.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  if (!call) {
    throw new Error(`Preload did not subscribe to ${channel}`)
  }

  return call[1] as IpcListener
}

describe('preload bridge origin policy', () => {
  it.each([
    ['neopot:', 'main_window'],
    ['http:', 'localhost'],
    ['http:', '127.0.0.1'],
    ['http:', '[::1]'],
  ])('exposes neoPot for trusted %s//%s renderers', async (protocol, hostname) => {
    await loadPreload(protocol, hostname)

    expect(electronMock.exposeInMainWorld).toHaveBeenCalledTimes(1)
    exposedApi()
  })

  it.each([
    ['https:', 'localhost'],
    ['http:', 'example.test'],
    ['file:', ''],
  ])('does not expose neoPot for untrusted %s//%s renderers', async (protocol, hostname) => {
    await loadPreload(protocol, hostname)

    expect(electronMock.exposeInMainWorld).not.toHaveBeenCalled()
  })
})

describe('preload bridge IPC behavior', () => {
  it('forwards matching app event payloads and removes the exact subscribed listener', async () => {
    await loadPreload('neopot:', 'main_window')
    const api = exposedApi()
    const callback = vi.fn()
    const unsubscribe = api.app.onEvent('config:changed', callback)
    const listener = listenerFor('app:event')

    listener({}, { event: 'unrelated', payload: 'ignored' })
    listener({}, { event: 'config:changed', payload: { key: 'theme' } })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith({ key: 'theme' })

    unsubscribe()
    expect(electronMock.removeListener).toHaveBeenCalledOnce()
    expect(electronMock.removeListener).toHaveBeenCalledWith('app:event', listener)
  })

  it('forwards updater payloads and removes the exact subscribed listener', async () => {
    await loadPreload('http:', 'localhost')
    const api = exposedApi()
    const callback = vi.fn()
    const unsubscribe = api.updater.onEvent(callback)
    const listener = listenerFor('update:event')
    const payload: UpdateEvent = { type: 'checking' }

    listener({}, payload)

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith(payload)

    unsubscribe()
    expect(electronMock.removeListener).toHaveBeenCalledOnce()
    expect(electronMock.removeListener).toHaveBeenCalledWith('update:event', listener)
  })

  it('forwards matching service stream payloads and removes the exact subscribed listener', async () => {
    await loadPreload('http:', '127.0.0.1')
    const api = exposedApi()
    const callback = vi.fn()
    const unsubscribe = api.services.onStream('translate-1', callback)
    const listener = listenerFor('services:stream')
    const payload = { eventId: 'translate-1', text: 'translated chunk' }

    listener({}, { eventId: 'translate-2', text: 'ignored' })
    listener({}, payload)

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith(payload)

    unsubscribe()
    expect(electronMock.removeListener).toHaveBeenCalledOnce()
    expect(electronMock.removeListener).toHaveBeenCalledWith('services:stream', listener)
  })
})
