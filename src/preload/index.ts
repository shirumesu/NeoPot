import { contextBridge, ipcRenderer } from 'electron'
import type {
  NeoPotElectronApi,
  PluginInfo,
  PluginInstallResult,
  TranslateRequest,
  TranslateResult,
  WindowLabel,
} from '../types/electron-api'

type IpcChannel =
  | 'app:get-window-label'
  | 'app:get-version'
  | 'app:close-current-window'
  | 'app:hide-current-window'
  | 'app:show-current-window'
  | 'app:focus-current-window'
  | 'app:set-current-window-always-on-top'
  | 'app:set-current-window-resizable'
  | 'app:set-current-window-bounds'
  | 'app:get-current-window-bounds'
  | 'app:is-current-window-maximized'
  | 'app:minimize-current-window'
  | 'app:maximize-current-window'
  | 'app:unmaximize-current-window'
  | 'app:emit'
  | 'hotkey:register'
  | 'hotkey:unregister'
  | 'hotkey:is-registered'
  | 'command:invoke'
  | 'config:get'
  | 'config:set'
  | 'workflow:selection-translate'
  | 'workflow:input-translate'
  | 'workflow:ocr-recognize'
  | 'workflow:ocr-translate'
  | 'services:translate'
  | 'plugins:install'
  | 'plugins:list'

const channels = new Set<IpcChannel>([
  'app:get-window-label',
  'app:get-version',
  'app:close-current-window',
  'app:hide-current-window',
  'app:show-current-window',
  'app:focus-current-window',
  'app:set-current-window-always-on-top',
  'app:set-current-window-resizable',
  'app:set-current-window-bounds',
  'app:get-current-window-bounds',
  'app:is-current-window-maximized',
  'app:minimize-current-window',
  'app:maximize-current-window',
  'app:unmaximize-current-window',
  'app:emit',
  'hotkey:register',
  'hotkey:unregister',
  'hotkey:is-registered',
  'command:invoke',
  'config:get',
  'config:set',
  'workflow:selection-translate',
  'workflow:input-translate',
  'workflow:ocr-recognize',
  'workflow:ocr-translate',
  'services:translate',
  'plugins:install',
  'plugins:list',
])

async function invokeChecked<TResult>(channel: IpcChannel, payload?: unknown): Promise<TResult> {
  if (!channels.has(channel)) {
    throw new Error(`Unknown IPC channel: ${channel}`)
  }

  return ipcRenderer.invoke(channel, payload) as Promise<TResult>
}

const api: NeoPotElectronApi = {
  app: {
    getWindowLabel: () => invokeChecked<WindowLabel>('app:get-window-label'),
    getVersion: () => invokeChecked<string>('app:get-version'),
    closeCurrentWindow: () => invokeChecked<void>('app:close-current-window'),
    hideCurrentWindow: () => invokeChecked<void>('app:hide-current-window'),
    showCurrentWindow: () => invokeChecked<void>('app:show-current-window'),
    focusCurrentWindow: () => invokeChecked<void>('app:focus-current-window'),
    setCurrentWindowAlwaysOnTop: (alwaysOnTop) =>
      invokeChecked<void>('app:set-current-window-always-on-top', { alwaysOnTop }),
    setCurrentWindowResizable: (resizable) =>
      invokeChecked<void>('app:set-current-window-resizable', { resizable }),
    setCurrentWindowBounds: (bounds) =>
      invokeChecked<void>('app:set-current-window-bounds', bounds),
    getCurrentWindowBounds: () => invokeChecked('app:get-current-window-bounds'),
    isCurrentWindowMaximized: () => invokeChecked<boolean>('app:is-current-window-maximized'),
    minimizeCurrentWindow: () => invokeChecked<void>('app:minimize-current-window'),
    maximizeCurrentWindow: () => invokeChecked<void>('app:maximize-current-window'),
    unmaximizeCurrentWindow: () => invokeChecked<void>('app:unmaximize-current-window'),
    emit: (event, payload) => invokeChecked<void>('app:emit', { event, payload }),
    onEvent: (eventId, callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'event' in payload &&
          payload.event === eventId
        ) {
          callback((payload as { payload?: unknown }).payload)
        }
      }

      ipcRenderer.on('app:event', listener)
      return () => ipcRenderer.removeListener('app:event', listener)
    },
  },
  hotkey: {
    register: (name, shortcut) => invokeChecked<boolean>('hotkey:register', { name, shortcut }),
    unregister: (shortcut) => invokeChecked<void>('hotkey:unregister', { shortcut }),
    isRegistered: (shortcut) => invokeChecked<boolean>('hotkey:is-registered', { shortcut }),
  },
  command: {
    invoke: (command, payload) => invokeChecked('command:invoke', { command, payload }),
  },
  config: {
    get: (key) => invokeChecked<unknown>('config:get', { key }),
    set: (key, value) => invokeChecked<void>('config:set', { key, value }),
  },
  workflow: {
    selectionTranslate: () => invokeChecked<void>('workflow:selection-translate'),
    inputTranslate: () => invokeChecked<void>('workflow:input-translate'),
    ocrRecognize: () => invokeChecked<void>('workflow:ocr-recognize'),
    ocrTranslate: () => invokeChecked<void>('workflow:ocr-translate'),
  },
  services: {
    translate: (request: TranslateRequest) =>
      invokeChecked<TranslateResult>('services:translate', request),
    onStream: (eventId, callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'eventId' in payload &&
          payload.eventId === eventId
        ) {
          callback(payload)
        }
      }

      ipcRenderer.on('services:stream', listener)
      return () => ipcRenderer.removeListener('services:stream', listener)
    },
  },
  plugins: {
    install: (file) => invokeChecked<PluginInstallResult>('plugins:install', { file }),
    list: (type) => invokeChecked<PluginInfo[]>('plugins:list', { type }),
  },
}

contextBridge.exposeInMainWorld('neoPot', api)
