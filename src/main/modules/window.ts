import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  app,
  BrowserWindow,
  Menu,
  screen,
  type BrowserWindowConstructorOptions,
  type WebContents,
} from 'electron'
import { getConfig, setConfig } from './config'

export type WindowLabel = 'config' | 'translate' | 'recognize' | 'screenshot' | 'updater'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

const windows = new Map<WindowLabel, BrowserWindow>()
const windowLabelsByWebContentsId = new Map<number, WindowLabel>()
const readyWindows = new Set<WindowLabel>()
const pendingWindowEvents = new Map<WindowLabel, Array<{ event: string; payload: unknown }>>()
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

function getAppIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function rendererUrl(label: WindowLabel): string | null {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return null
  }

  const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  url.searchParams.set('window', label)
  return url.toString()
}

async function loadRenderer(window: BrowserWindow, label: WindowLabel) {
  const url = rendererUrl(label)
  if (url) {
    await window.loadURL(url)
    return
  }

  await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
    query: {
      window: label,
    },
  })
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

  const definition = windowDefinitions[label]
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
      preload: path.join(__dirname, 'preload.cjs'),
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
    } else if (label === 'config' || label === 'recognize' || label === 'updater') {
      window.center()
    }
    showWindowInForeground(window, label)
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
      setConfig('translate_window_width', width)
      setConfig('translate_window_height', height)
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
  const existing = windows.get(label)
  if (existing && !existing.isDestroyed()) {
    focusWindow(label)
    return existing
  }

  const window = createBrowserWindow(label)
  await loadRenderer(window, label)
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
    return
  }

  if (!readyWindows.has(label)) {
    const events = pendingWindowEvents.get(label) ?? []
    events.push({ event, payload })
    pendingWindowEvents.set(label, events)
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
  flushPendingWindowEvents(label)
}

export function markAppQuitting(): void {
  appIsQuitting = true
}
