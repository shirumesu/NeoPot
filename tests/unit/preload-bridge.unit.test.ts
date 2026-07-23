import type { NeoPotElectronApi, UpdateEvent } from '../../src/shared/types/electron-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type IpcListener = (event: unknown, payload: unknown) => void

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  postMessage: vi.fn(),
  removeListener: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: electronMock.on,
    postMessage: electronMock.postMessage,
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
    expect(exposedApi().app.platform).toBe('Windows_NT')
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
  it('forwards buffered HTTP requests through the dedicated typed channel', async () => {
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { translated: true },
    }
    electronMock.invoke.mockResolvedValueOnce(response)
    await loadPreload('neopot:', 'main_window')

    const request = {
      url: 'https://example.test/translate',
      method: 'POST',
      body: { kind: 'json' as const, data: { text: 'hello' } },
    }
    await expect(exposedApi().http.request(request)).resolves.toEqual(response)
    expect(electronMock.invoke).toHaveBeenCalledWith('http:request', request)
  })

  it('transfers streaming HTTP events and cancels through the dedicated message port', async () => {
    const port1 = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      start: vi.fn(),
      postMessage: vi.fn(),
      close: vi.fn(),
    }
    const port2 = {}
    vi.stubGlobal(
      'MessageChannel',
      class {
        port1 = port1
        port2 = port2
      },
    )
    await loadPreload('neopot:', 'main_window')
    const callback = vi.fn()
    const request = { url: 'https://example.test/stream' }

    const cancel = exposedApi().http.stream(request, callback)
    expect(electronMock.postMessage).toHaveBeenCalledWith('http:stream', request, [port2])
    expect(port1.start).toHaveBeenCalledOnce()

    const chunk = { type: 'chunk' as const, data: new Uint8Array([1, 2, 3]) }
    port1.onmessage?.({ data: chunk })
    expect(callback).toHaveBeenCalledWith(chunk)

    cancel()
    expect(port1.postMessage).toHaveBeenCalledWith({ type: 'cancel' })
    expect(port1.close).toHaveBeenCalledOnce()
  })

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
})
