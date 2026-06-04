import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  Menu,
  net,
  protocol,
  screen,
  type BrowserWindowConstructorOptions,
  type WebContents,
} from 'electron'
import { getConfig, setConfig } from './config'
import { RENDERER_HOST, RENDERER_SCHEME, resolveRendererFile } from './rendererProtocol'
import { logger } from '../logger'

export type WindowLabel = 'config' | 'translate' | 'recognize' | 'screenshot' | 'updater'
type UpdaterPresentation = 'full' | 'notification'

const windows = new Map<WindowLabel, BrowserWindow>()
const windowLabelsByWebContentsId = new Map<number, WindowLabel>()
const readyWindows = new Set<WindowLabel>()
const pendingWindowEvents = new Map<WindowLabel, Array<{ event: string; payload: unknown }>>()
let updaterPresentation: UpdaterPresentation = 'full'
let appIsQuitting = false
let translateResizeTimer: NodeJS.Timeout | null = null

interface WindowDefinition {
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  skipTaskbar?: boolean
  fullscreen?: boolean
  alwaysOnTop?: boolean
  transparent?: boolean
  resizable?: boolean
}

const windowDefinitions: Record<WindowLabel, WindowDefinition> = {
  config: {
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 400,
    resizable: true,
  },
  translate: {
    width: 350,
    height: 420,
    skipTaskbar: true,
    transparent: true,
    resizable: true,
  },
  recognize: {
    width: 900,
    height: 520,
    transparent: true,
    resizable: true,
  },
  screenshot: {
    width: 800,
    height: 600,
    skipTaskbar: true,
    fullscreen: true,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
  },
  updater: {
    width: 600,
    height: 400,
    minWidth: 600,
    minHeight: 400,
    resizable: true,
  },
}

const updaterNotificationDefinition: WindowDefinition = {
  width: 360,
  height: 220,
  minWidth: 360,
  minHeight: 220,
  skipTaskbar: true,
  resizable: false,
}

function getAppIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function getRendererRoot(): string {
  return path.join(__dirname, '..', 'renderer')
}

function rendererUrl(label: WindowLabel, presentation: UpdaterPresentation = 'full'): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', label)
    if (label === 'updater') {
      url.searchParams.set('presentation', presentation)
    }
    return url.toString()
  }

  // Packaged builds serve the renderer over `neopot://` so the page has a
  // non-`file:` origin. PaddleOCR.js (`ensureServedFromHttp`) refuses to fetch
  // its model assets on a `file:` origin, which broke OCR in packaged builds.
  const url = new URL(`${RENDERER_SCHEME}://${RENDERER_HOST}/index.html`)
  url.searchParams.set('window', label)
  if (label === 'updater') {
    url.searchParams.set('presentation', presentation)
  }
  return url.toString()
}

// Serves the packaged renderer bundle over the custom scheme. Must run after
// the app is ready and before any window loads. Dev keeps using Vite's http
// server, so the handler is only needed for packaged builds.
export function registerRendererProtocol(): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    return
  }

  const root = getRendererRoot()
  protocol.handle(RENDERER_SCHEME, async (request) => {
    const filePath = resolveRendererFile(request.url, root)
    if (!filePath) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

async function loadRenderer(window: BrowserWindow, label: WindowLabel) {
  await window.loadURL(rendererUrl(label, label === 'updater' ? updaterPresentation : 'full'))
}

function positionTranslateWindow(window: BrowserWindow) {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor) ?? screen.getPrimaryDisplay()
  const bounds = display.workArea
  const [width, height] = window.getSize()

  const x = Math.max(bounds.x, Math.min(cursor.x, bounds.x + bounds.width - width))
  const y = Math.max(bounds.y, Math.min(cursor.y, bounds.y + bounds.height - height))
  window.setPosition(x, y)
}

function positionUpdaterNotification(window: BrowserWindow) {
  const display = screen.getPrimaryDisplay()
  const bounds = display.workArea
  const [width, height] = window.getSize()
  window.setPosition(bounds.x + bounds.width - width - 16, bounds.y + bounds.height - height - 16)
}

function getTranslateWindowSize(definition: WindowDefinition): { width: number; height: number } {
  if (getConfig('translate_remember_window_size') !== true) {
    return {
      width: definition.width,
      height: definition.height,
    }
  }

  const width = Number(getConfig('translate_window_width'))
  const height = Number(getConfig('translate_window_height'))
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 180) {
    return {
      width: definition.width,
      height: definition.height,
    }
  }

  return {
    width,
    height,
  }
}

function emitWindowEvent(window: BrowserWindow, event: string): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return
  }

  window.webContents.send('app:event', {
    event,
  })
}

function flushPendingWindowEvents(label: WindowLabel): void {
  const window = windows.get(label)
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return
  }

  const events = pendingWindowEvents.get(label) ?? []
  pendingWindowEvents.delete(label)
  if (events.length > 0) {
    logger.debug('Flushing queued window events.', {
      window: label,
      count: events.length,
    })
  }
  for (const queuedEvent of events) {
    window.webContents.send('app:event', queuedEvent)
  }
}

function showWindowInForeground(window: BrowserWindow, label: WindowLabel): void {
  const restoreAlwaysOnTop = window.isAlwaysOnTop()

  if (label === 'translate' && !restoreAlwaysOnTop) {
    window.setAlwaysOnTop(true)
  }

  window.show()
  window.focus()

  if (label === 'translate' && !restoreAlwaysOnTop) {
    setTimeout(() => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed() && !restoreAlwaysOnTop) {
        window.setAlwaysOnTop(false)
      }
    }, 300)
  }
}

function createBrowserWindow(label: WindowLabel): BrowserWindow {
  Menu.setApplicationMenu(null)
  logger.debug('Creating window.', {
    window: label,
  })

  const definition =
    label === 'updater' && updaterPresentation === 'notification'
      ? updaterNotificationDefinition
      : windowDefinitions[label]
  const size = label === 'translate' ? getTranslateWindowSize(definition) : definition
  const options: BrowserWindowConstructorOptions = {
    width: size.width,
    height: size.height,
    minWidth: definition.minWidth,
    minHeight: definition.minHeight,
    show: false,
    frame: false,
    thickFrame: true,
    transparent: definition.transparent,
    skipTaskbar: definition.skipTaskbar,
    fullscreen: definition.fullscreen,
    alwaysOnTop: definition.alwaysOnTop,
    resizable: definition.resizable,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  }

  const window = new BrowserWindow(options)
  const webContentsId = window.webContents.id
  windows.set(label, window)
  windowLabelsByWebContentsId.set(webContentsId, label)

  window.once('ready-to-show', () => {
    if (label === 'translate') {
      positionTranslateWindow(window)
    } else if (label === 'updater' && updaterPresentation === 'notification') {
      positionUpdaterNotification(window)
    } else if (label === 'config' || label === 'recognize' || label === 'updater') {
      window.center()
    }
    showWindowInForeground(window, label)
    logger.debug('Window ready to show.', {
      window: label,
    })
  })

  window.on('focus', () => emitWindowEvent(window, 'tauri://focus'))
  window.on('blur', () => emitWindowEvent(window, 'tauri://blur'))
  window.on('move', () => emitWindowEvent(window, 'tauri://move'))
  window.on('resize', () => {
    emitWindowEvent(window, 'tauri://resize')
    if (label !== 'translate' || getConfig('translate_remember_window_size') !== true) {
      return
    }

    if (translateResizeTimer) {
      clearTimeout(translateResizeTimer)
    }
    translateResizeTimer = setTimeout(() => {
      if (window.isDestroyed()) {
        return
      }
      const [width, height] = window.getSize()
      void Promise.all([
        setConfig('translate_window_width', width),
        setConfig('translate_window_height', height),
      ]).catch((error) => {
        logger.error('Failed to save translate window size.', error)
      })
    }, 100)
  })
  window.on('close', (event) => {
    const closeToTray = getConfig('close_to_tray') !== false
    if (label !== 'config' || appIsQuitting || !closeToTray) {
      return
    }

    event.preventDefault()
    window.hide()
  })

  window.on('closed', () => {
    windows.delete(label)
    windowLabelsByWebContentsId.delete(webContentsId)
    readyWindows.delete(label)
    pendingWindowEvents.delete(label)
  })

  return window
}

export async function openWindow(label: WindowLabel): Promise<BrowserWindow> {
  if (label === 'updater') {
    updaterPresentation = 'full'
  }

  const existing = windows.get(label)
  if (existing && !existing.isDestroyed()) {
    logger.debug('Focusing existing window.', {
      window: label,
    })
    focusWindow(label)
    return existing
  }

  logger.debug('Opening new window.', {
    window: label,
  })
  const window = createBrowserWindow(label)
  await loadRenderer(window, label)
  return window
}

export async function openUpdaterNotification(): Promise<BrowserWindow> {
  updaterPresentation = 'notification'

  const existing = windows.get('updater')
  if (existing && !existing.isDestroyed()) {
    existing.setResizable(false)
    existing.setSize(updaterNotificationDefinition.width, updaterNotificationDefinition.height)
    existing.setSkipTaskbar(true)
    await existing.loadURL(rendererUrl('updater', 'notification'))
    positionUpdaterNotification(existing)
    showWindowInForeground(existing, 'updater')
    return existing
  }

  logger.debug('Opening updater notification window.')
  const window = createBrowserWindow('updater')
  await loadRenderer(window, 'updater')
  return window
}

export function focusWindow(label: WindowLabel): void {
  const window = windows.get(label)
  if (!window || window.isDestroyed()) {
    return
  }

  if (window.isMinimized()) {
    window.restore()
  }
  if (label === 'translate') {
    positionTranslateWindow(window)
  }
  showWindowInForeground(window, label)
}

export function sendToWindow(label: WindowLabel, event: string, payload: unknown): void {
  const window = windows.get(label)
  if (!window || window.isDestroyed()) {
    const events = pendingWindowEvents.get(label) ?? []
    events.push({ event, payload })
    pendingWindowEvents.set(label, events)
    logger.debug('Queued event for missing window.', {
      window: label,
      event,
      queueLength: events.length,
    })
    return
  }

  if (!readyWindows.has(label)) {
    const events = pendingWindowEvents.get(label) ?? []
    events.push({ event, payload })
    pendingWindowEvents.set(label, events)
    logger.debug('Queued event for pending window.', {
      window: label,
      event,
      queueLength: events.length,
    })
    return
  }

  window.webContents.send('app:event', { event, payload })
}

export function getCurrentWindowLabel(webContents: WebContents): WindowLabel {
  return windowLabelsByWebContentsId.get(webContents.id) ?? 'config'
}

export function getWindow(label: WindowLabel): BrowserWindow | undefined {
  return windows.get(label)
}

export function markWindowReady(label: WindowLabel): void {
  readyWindows.add(label)
  logger.debug('Window renderer ready.', {
    window: label,
  })
  flushPendingWindowEvents(label)
}

export function markAppQuitting(): void {
  appIsQuitting = true
}
