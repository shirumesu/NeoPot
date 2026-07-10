import { beforeEach, describe, expect, it, vi } from 'vitest'

type WindowEventHandler = (...args: unknown[]) => void

const electronMock = vi.hoisted(() => {
  let nextWebContentsId = 1
  const display = {
    id: 7,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1.25,
  }
  const instances: FakeBrowserWindow[] = []

  class FakeBrowserWindow {
    options: Record<string, unknown>
    destroyed = false
    minimized = false
    alwaysOnTop = false
    hidden = false
    url = ''
    size: [number, number]
    position: [number, number] = [0, 0]
    handlers = new Map<string, WindowEventHandler[]>()
    webContents: {
      id: number
      isDestroyed: ReturnType<typeof vi.fn>
      send: ReturnType<typeof vi.fn>
    }
    loadURL: ReturnType<typeof vi.fn>
    setPosition = vi.fn((x: number, y: number) => {
      this.position = [x, y]
    })
    setSize = vi.fn((width: number, height: number) => {
      this.size = [width, height]
    })
    setMinimumSize = vi.fn()
    setResizable = vi.fn()
    setSkipTaskbar = vi.fn()
    setAlwaysOnTop = vi.fn((value: boolean) => {
      this.alwaysOnTop = value
    })
    show = vi.fn()
    focus = vi.fn()
    restore = vi.fn(() => {
      this.minimized = false
    })
    center = vi.fn()
    hide = vi.fn(() => {
      this.hidden = true
    })

    constructor(options: Record<string, unknown>) {
      this.options = options
      this.size = [Number(options.width), Number(options.height)]
      this.webContents = {
        id: nextWebContentsId++,
        isDestroyed: vi.fn(() => this.destroyed),
        send: vi.fn(),
      }
      this.loadURL = vi.fn(async (url: string) => {
        this.url = url
      })
      instances.push(this)
    }

    once(event: string, handler: WindowEventHandler) {
      const onceHandler: WindowEventHandler = (...args) => {
        this.removeHandler(event, onceHandler)
        handler(...args)
      }
      this.addHandler(event, onceHandler)
    }

    on(event: string, handler: WindowEventHandler) {
      this.addHandler(event, handler)
    }

    trigger(event: string, ...args: unknown[]) {
      for (const handler of [...(this.handlers.get(event) ?? [])]) {
        handler(...args)
      }
    }

    private addHandler(event: string, handler: WindowEventHandler) {
      const handlers = this.handlers.get(event) ?? []
      handlers.push(handler)
      this.handlers.set(event, handlers)
    }

    private removeHandler(event: string, handler: WindowEventHandler) {
      this.handlers.set(
        event,
        (this.handlers.get(event) ?? []).filter((candidate) => candidate !== handler),
      )
    }

    isDestroyed() {
      return this.destroyed
    }

    isAlwaysOnTop() {
      return this.alwaysOnTop
    }

    isMinimized() {
      return this.minimized
    }

    getSize(): [number, number] {
      return this.size
    }

    getBounds() {
      return { x: this.position[0], y: this.position[1], width: this.size[0], height: this.size[1] }
    }
  }

  return {
    app: {
      getAppPath: vi.fn(() => 'D:/NeoPot'),
      isPackaged: true,
    },
    BrowserWindow: FakeBrowserWindow,
    display,
    instances,
    Menu: { setApplicationMenu: vi.fn() },
    net: { fetch: vi.fn() },
    protocol: { handle: vi.fn() },
    screen: {
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 400 })),
      getDisplayNearestPoint: vi.fn(() => display),
      getPrimaryDisplay: vi.fn(() => display),
      getDisplayMatching: vi.fn(() => display),
    },
    reset() {
      nextWebContentsId = 1
      instances.length = 0
    },
  }
})

const configMock = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  return {
    values,
    getConfig: vi.fn((key: string) => values.get(key)),
    setConfig: vi.fn(),
  }
})

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

const sizingMock = vi.hoisted(() => ({
  calculateAdaptiveTranslateWindowSize: vi.fn(() => ({ width: 640, height: 480 })),
}))

const screenshotMock = vi.hoisted(() => ({
  getCapturePng: vi.fn(() => Buffer.from('png bytes')),
}))

vi.mock('electron', () => ({
  app: electronMock.app,
  BrowserWindow: electronMock.BrowserWindow,
  Menu: electronMock.Menu,
  net: electronMock.net,
  protocol: electronMock.protocol,
  screen: electronMock.screen,
}))
vi.mock('../../src/main/modules/config', () => ({
  getConfig: configMock.getConfig,
  setConfig: configMock.setConfig,
}))
vi.mock('../../src/main/modules/rendererProtocol', () => ({
  RENDERER_HOST: 'main_window',
  RENDERER_SCHEME: 'neopot',
  SCREENSHOT_PATH: '/__runtime/screenshot.png',
  resolveRendererFile: vi.fn(),
}))
vi.mock('../../src/main/logger', () => ({ logger: loggerMock }))
vi.mock('../../src/shared/translateWindowSizing', () => sizingMock)
vi.mock('../../src/main/modules/screenshot', () => screenshotMock)

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useRealTimers()
  electronMock.reset()
  configMock.values.clear()
  configMock.setConfig.mockResolvedValue(undefined)
  delete process.env.ELECTRON_RENDERER_URL
})

async function loadWindowModule() {
  return import('../../src/main/modules/window')
}

function lastWindow(): InstanceType<typeof electronMock.BrowserWindow> {
  const window = electronMock.instances.at(-1)
  if (!window) {
    throw new Error('Expected a BrowserWindow to be created')
  }
  return window
}

describe('Main window event delivery', () => {
  it('queues events before a window exists and flushes them in order when the renderer is ready', async () => {
    const windows = await loadWindowModule()

    windows.sendToWindow('translate', 'first', { order: 1 })
    windows.sendToWindow('translate', 'second', { order: 2 })
    await windows.openWindow('translate')
    const window = lastWindow()

    expect(window.webContents.send).not.toHaveBeenCalled()
    windows.markWindowReady('translate')

    expect(window.webContents.send.mock.calls).toEqual([
      ['app:event', { event: 'first', payload: { order: 1 } }],
      ['app:event', { event: 'second', payload: { order: 2 } }],
    ])
  })

  it('keeps only the newest 25 queued events when a renderer remains unavailable', async () => {
    const windows = await loadWindowModule()

    for (let index = 0; index < 27; index += 1) {
      windows.sendToWindow('config', `event-${index}`, index)
    }
    await windows.openWindow('config')
    const window = lastWindow()
    windows.markWindowReady('config')

    expect(window.webContents.send).toHaveBeenCalledTimes(25)
    expect(window.webContents.send).toHaveBeenNthCalledWith(1, 'app:event', {
      event: 'event-2',
      payload: 2,
    })
    expect(window.webContents.send).toHaveBeenLastCalledWith('app:event', {
      event: 'event-26',
      payload: 26,
    })
    expect(loggerMock.warn).toHaveBeenCalledTimes(2)
  })

  it('sends directly after readiness and forwards lifecycle events through app:event', async () => {
    const windows = await loadWindowModule()
    await windows.openWindow('config')
    const window = lastWindow()
    windows.markWindowReady('config')
    window.webContents.send.mockClear()

    windows.sendToWindow('config', 'custom', { ready: true })
    window.trigger('focus')
    window.trigger('blur')
    window.trigger('move')
    window.trigger('resize')

    expect(window.webContents.send.mock.calls).toEqual([
      ['app:event', { event: 'custom', payload: { ready: true } }],
      ['app:event', { event: 'neopot://focus' }],
      ['app:event', { event: 'neopot://blur' }],
      ['app:event', { event: 'neopot://move' }],
      ['app:event', { event: 'neopot://resize' }],
    ])
  })
})

describe('Main renderer protocol', () => {
  it('serves the current screenshot as uncached PNG bytes', async () => {
    const windows = await loadWindowModule()
    windows.registerRendererProtocol()

    const handler = electronMock.protocol.handle.mock.calls[0]?.[1]
    expect(handler).toBeTypeOf('function')

    const response = await handler({
      url: 'neopot://main_window/__runtime/screenshot.png?v=1',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('png bytes'))
  })
})

describe('Main window lifecycle behavior', () => {
  it('temporarily raises the translate window while focusing and restores its prior level', async () => {
    vi.useFakeTimers()
    const windows = await loadWindowModule()
    await windows.openWindow('translate')
    const window = lastWindow()
    window.trigger('ready-to-show')

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true)
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.alwaysOnTop).toBe(true)

    await vi.advanceTimersByTimeAsync(300)
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(false)
    expect(window.alwaysOnTop).toBe(false)
  })

  it('hides the config window on close until application shutdown is marked', async () => {
    const windows = await loadWindowModule()
    await windows.openWindow('config')
    const window = lastWindow()
    const firstClose = { preventDefault: vi.fn() }

    window.trigger('close', firstClose)
    expect(firstClose.preventDefault).toHaveBeenCalledOnce()
    expect(window.hide).toHaveBeenCalledOnce()

    windows.markAppQuitting()
    const shutdownClose = { preventDefault: vi.fn() }
    window.trigger('close', shutdownClose)
    expect(shutdownClose.preventDefault).not.toHaveBeenCalled()
  })

  it('switches one updater window between notification and full presentations', async () => {
    const windows = await loadWindowModule()

    const notification = await windows.openUpdaterNotification()
    const window = lastWindow()
    expect(notification).toBe(window)
    expect(window.url).toContain('presentation=notification')
    expect(window.options.skipTaskbar).toBe(true)

    windows.markWindowReady('updater')
    const full = await windows.openWindow('updater')

    expect(full).toBe(window)
    expect(electronMock.instances).toHaveLength(1)
    expect(window.url).toContain('presentation=full')
    expect(window.setMinimumSize).toHaveBeenLastCalledWith(640, 440)
    expect(window.setResizable).toHaveBeenLastCalledWith(true)
    expect(window.setSkipTaskbar).toHaveBeenLastCalledWith(false)
    expect(window.setSize).toHaveBeenLastCalledWith(720, 520)
    expect(window.center).toHaveBeenCalledOnce()

    window.webContents.send.mockClear()
    windows.sendToWindow('updater', 'after-switch', true)
    expect(window.webContents.send).not.toHaveBeenCalled()
    windows.markWindowReady('updater')
    expect(window.webContents.send).toHaveBeenCalledWith('app:event', {
      event: 'after-switch',
      payload: true,
    })
  })

  it('uses adaptive sizing only when enabled and remembered sizing is disabled', async () => {
    configMock.values.set('translate_adaptive_window_size', true)
    configMock.values.set('translate_remember_window_size', false)
    configMock.values.set('app_font_size', 18)
    const windows = await loadWindowModule()
    await windows.openWindow('translate')
    const window = lastWindow()

    windows.resizeTranslateWindowForText('  meaningful text  ')

    expect(sizingMock.calculateAdaptiveTranslateWindowSize).toHaveBeenCalledWith({
      text: 'meaningful text',
      workArea: { width: 1920, height: 1040 },
      fontSize: 18,
    })
    expect(window.setSize).toHaveBeenCalledWith(640, 480)
    expect(window.setPosition).toHaveBeenCalled()
  })
})
