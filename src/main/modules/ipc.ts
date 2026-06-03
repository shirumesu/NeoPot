import {
  BrowserWindow,
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type IpcMainInvokeEvent,
  type Rectangle,
} from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { isLogLevel, toLogTransportLevel } from '../../shared/logLevel'
import { getMainLogTransportLevel, logger, setMainLogTransportLevel } from '../logger'
import { translate as translateService } from '../services'
import {
  installPluginFromUrl,
  installPlugin,
  listInstalledPlugins,
  pluginRoot,
  readPluginManifestFromSource,
  setPluginEnabled,
  uninstallPlugin,
} from '../plugins/installer'
import { getRedactedConfig, setConfig } from './config'
import {
  isGlobalShortcutRegistered,
  registerGlobalShortcutByName,
  unregisterGlobalShortcut,
} from './hotkey'
import { rendererHttpRequest } from './http'
import { detectLanguage } from './lang-detect'
import {
  captureDisplayForPoint,
  getCaptureDataUrl,
  getCroppedBase64,
  getLastCroppedBase64,
  getLastCroppedDataUrl,
} from './screenshot'
import { updateTrayMenu } from './tray'
import { markWindowReady, type WindowLabel } from './window'
import {
  getCurrentScreenshotAction,
  getCurrentWorkflowText,
  imageTranslate,
  inputTranslate,
  ocrRecognize,
  ocrTranslate,
  openUpdater,
  recognizeWindow,
  selectionTranslate,
  textTranslate,
} from './workflow'
import { APP_USER_MODEL_ID } from './appIdentity'

export interface NeoPotErrorPayload {
  code: 'IPC_UNKNOWN_CHANNEL' | 'IPC_INVALID_PAYLOAD' | 'IPC_HANDLER_FAILED'
  message: string
  field?: string
}

export class NeoPotError extends Error {
  readonly code: NeoPotErrorPayload['code']
  readonly field?: string

  constructor(payload: NeoPotErrorPayload) {
    super(payload.message)
    this.name = 'NeoPotError'
    this.code = payload.code
    this.field = payload.field
  }
}

type IpcHandler = (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown> | unknown

type AutoStartLoginItemCompareOptions = {
  path?: string
  args?: string[]
}

type AutoStartLoginItemSetOptions = AutoStartLoginItemCompareOptions & {
  name?: string
}

interface RegisterIpcHandlersOptions {
  getWindowLabel(event: IpcMainInvokeEvent): WindowLabel
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function getAutoStartLoginItemCompareOptions(): AutoStartLoginItemCompareOptions {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return {}
  }

  const appFolder = path.dirname(process.execPath)
  const exeName = path.basename(process.execPath)

  return {
    path: path.resolve(appFolder, '..', exeName),
    args: [],
  }
}

function getAutoStartLoginItemSetOptions(): AutoStartLoginItemSetOptions {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return {}
  }

  return {
    ...getAutoStartLoginItemCompareOptions(),
    name: APP_USER_MODEL_ID,
  }
}

const assertNoPayload = (payload: unknown) => {
  if (payload !== undefined) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected no payload.',
    })
  }
}

const assertKeyPayload = (payload: unknown): { key: string; value?: unknown } => {
  if (!isRecord(payload) || typeof payload.key !== 'string' || payload.key.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a non-empty config key.',
      field: 'key',
    })
  }

  return {
    key: payload.key,
    value: payload.value,
  }
}

const assertPluginInstallPayload = (payload: unknown): { file: string } => {
  if (!isRecord(payload) || typeof payload.file !== 'string' || payload.file.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a plugin file path.',
      field: 'file',
    })
  }

  return { file: payload.file }
}

const assertPluginInstallUrlPayload = (payload: unknown): { url: string } => {
  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a plugin URL or local source path.',
      field: 'url',
    })
  }

  return { url: payload.url }
}

const assertPluginListPayload = (payload: unknown): { type: string } => {
  if (!isRecord(payload) || typeof payload.type !== 'string' || payload.type.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a plugin type.',
      field: 'type',
    })
  }

  return { type: payload.type }
}

const assertOptionalPluginListPayload = (payload: unknown): { type?: string } => {
  if (payload === undefined) {
    return {}
  }

  if (!isRecord(payload)) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin list payload.',
    })
  }

  return {
    type: typeof payload.type === 'string' ? payload.type : undefined,
  }
}

const assertPluginIdentityPayload = (payload: unknown): { type: string; name: string } => {
  if (
    !isRecord(payload) ||
    typeof payload.type !== 'string' ||
    payload.type.length === 0 ||
    typeof payload.name !== 'string' ||
    payload.name.length === 0
  ) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin type and name.',
    })
  }

  return { type: payload.type, name: payload.name }
}

const assertPluginEnabledPayload = (
  payload: unknown,
): { type: string; name: string; enabled: boolean } => {
  const { type, name } = assertPluginIdentityPayload(payload)
  if (!isRecord(payload) || typeof payload.enabled !== 'boolean') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin enabled state.',
      field: 'enabled',
    })
  }

  return { type, name, enabled: payload.enabled }
}

const assertBooleanPayload = (payload: unknown, field: string): boolean => {
  if (!isRecord(payload) || typeof payload[field] !== 'boolean') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: `Expected boolean field: ${field}.`,
      field,
    })
  }

  return payload[field]
}

const assertWindowBoundsPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected window bounds object.',
    })
  }

  const bounds: Rectangle = {
    x: Number(payload.x ?? 0),
    y: Number(payload.y ?? 0),
    width: Number(payload.width ?? 0),
    height: Number(payload.height ?? 0),
  }

  return {
    x: typeof payload.x === 'number' ? bounds.x : undefined,
    y: typeof payload.y === 'number' ? bounds.y : undefined,
    width: typeof payload.width === 'number' ? bounds.width : undefined,
    height: typeof payload.height === 'number' ? bounds.height : undefined,
  }
}

const assertEventPayload = (payload: unknown): { event: string; payload?: unknown } => {
  if (!isRecord(payload) || typeof payload.event !== 'string' || payload.event.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a non-empty event name.',
      field: 'event',
    })
  }

  return {
    event: payload.event,
    payload: payload.payload,
  }
}

const assertShortcutPayload = (payload: unknown): { name?: string; shortcut: string } => {
  if (!isRecord(payload) || typeof payload.shortcut !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected shortcut string.',
      field: 'shortcut',
    })
  }

  return {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    shortcut: payload.shortcut,
  }
}

const assertCommandPayload = (
  payload: unknown,
): { command: string; payload?: Record<string, unknown> } => {
  if (!isRecord(payload) || typeof payload.command !== 'string' || payload.command.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected command string.',
      field: 'command',
    })
  }

  return {
    command: payload.command,
    payload: isRecord(payload.payload) ? payload.payload : undefined,
  }
}

const assertDialogOpenPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    return {}
  }

  const allowedProperties = new Set(['openFile', 'openDirectory', 'multiSelections'])
  const properties = Array.isArray(payload.properties)
    ? payload.properties.filter(
        (property): property is 'openFile' | 'openDirectory' | 'multiSelections' =>
          typeof property === 'string' && allowedProperties.has(property),
      )
    : undefined

  const filters = Array.isArray(payload.filters)
    ? payload.filters
        .filter(
          (filter) =>
            isRecord(filter) && typeof filter.name === 'string' && Array.isArray(filter.extensions),
        )
        .map((filter) => ({
          name: filter.name as string,
          extensions: (filter.extensions as unknown[]).filter(
            (extension): extension is string => typeof extension === 'string',
          ),
        }))
    : undefined

  return {
    multiple: payload.multiple === true,
    directory: payload.directory === true,
    properties,
    filters,
  }
}

const resolveBaseDirectory = (baseDir: unknown): string | null => {
  switch (baseDir) {
    case 'AppConfig':
      return app.getPath('userData')
    case 'AppCache':
      return path.join(app.getPath('userData'), 'Cache')
    case 'AppLog':
      return app.getPath('logs')
    default:
      return null
  }
}

const assertPathPayload = (payload: unknown): { filePath: string; baseDir?: string } => {
  if (!isRecord(payload) || typeof payload.path !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected file path.',
      field: 'path',
    })
  }

  return {
    filePath: payload.path,
    baseDir: typeof payload.baseDir === 'string' ? payload.baseDir : undefined,
  }
}

const resolveFilePath = (payload: unknown): string => {
  const { filePath, baseDir } = assertPathPayload(payload)
  const basePath = resolveBaseDirectory(baseDir)
  return basePath && !path.isAbsolute(filePath) ? path.join(basePath, filePath) : filePath
}

const assertTextPayload = (payload: unknown): string => {
  if (!isRecord(payload) || typeof payload.text !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected text string.',
      field: 'text',
    })
  }

  return payload.text
}

const assertUrlPayload = (payload: unknown): string => {
  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected URL string.',
      field: 'url',
    })
  }

  return payload.url
}

const normalizeError = (error: unknown): NeoPotErrorPayload => {
  if (error instanceof NeoPotError) {
    return {
      code: error.code,
      message: error.message,
      field: error.field,
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    code: 'IPC_HANDLER_FAILED',
    message,
  }
}

const summarizePayloadForLog = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) {
    return {
      payloadType: typeof payload,
    }
  }

  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const summaryKey = `payload_${key}`
    if (typeof value === 'string') {
      summary[summaryKey] = `[string length=${value.length}]`
    } else if (Array.isArray(value)) {
      summary[summaryKey] = `[array length=${value.length}]`
    } else if (isRecord(value)) {
      summary[summaryKey] = `[object keys=${Object.keys(value).length}]`
    } else {
      summary[summaryKey] = value
    }
  }

  return summary
}

const execFileAsync = promisify(execFile)

function broadcastAppEvent(event: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue
    }
    window.webContents.send('app:event', {
      event,
      payload,
    })
  }
}

async function listSystemFonts(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return []
  }

  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }',
    ],
    {
      windowsHide: true,
      timeout: 5000,
    },
  )

  return [
    ...new Set(
      stdout
        .split(/\r?\n/)
        .map((font) => font.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b))
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const handlers: Record<string, IpcHandler> = {
    'app:get-window-label': (event, payload) => {
      assertNoPayload(payload)
      return options.getWindowLabel(event)
    },
    'app:get-version': (_event, payload) => {
      assertNoPayload(payload)
      return app.getVersion()
    },
    'app:renderer-ready': (event, payload) => {
      assertNoPayload(payload)
      markWindowReady(options.getWindowLabel(event))
    },
    'app:close-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.close()
    },
    'app:hide-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.hide()
    },
    'app:show-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.show()
    },
    'app:focus-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.focus()
    },
    'app:set-current-window-always-on-top': (event, payload) => {
      BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(
        assertBooleanPayload(payload, 'alwaysOnTop'),
      )
    },
    'app:set-current-window-resizable': (event, payload) => {
      BrowserWindow.fromWebContents(event.sender)?.setResizable(
        assertBooleanPayload(payload, 'resizable'),
      )
    },
    'app:set-current-window-bounds': (event, payload) => {
      BrowserWindow.fromWebContents(event.sender)?.setBounds(assertWindowBoundsPayload(payload))
    },
    'app:get-current-window-bounds': (event, payload) => {
      assertNoPayload(payload)
      return (
        BrowserWindow.fromWebContents(event.sender)?.getBounds() ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        }
      )
    },
    'app:is-current-window-maximized': (event, payload) => {
      assertNoPayload(payload)
      return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
    },
    'app:set-auto-start': (_event, payload) => {
      app.setLoginItemSettings({
        openAtLogin: assertBooleanPayload(payload, 'enabled'),
        ...getAutoStartLoginItemSetOptions(),
      })
    },
    'app:is-auto-start-enabled': (_event, payload) => {
      assertNoPayload(payload)
      return app.getLoginItemSettings(getAutoStartLoginItemCompareOptions()).openAtLogin
    },
    'app:minimize-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    },
    'app:maximize-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.maximize()
    },
    'app:unmaximize-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.unmaximize()
    },
    'app:emit': (_event, payload) => {
      const emitted = assertEventPayload(payload)
      broadcastAppEvent(emitted.event, emitted.payload)
    },
    'dialog:open': async (_event, payload) => {
      const options = assertDialogOpenPayload(payload)
      const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> =
        options.properties && options.properties.length > 0
          ? options.properties
          : [options.directory ? 'openDirectory' : 'openFile']
      if (options.multiple && !properties.includes('multiSelections')) {
        properties.push('multiSelections')
      }

      const result = await dialog.showOpenDialog({
        properties,
        filters: options.filters,
      })

      if (result.canceled) {
        return null
      }

      return options.multiple ? result.filePaths : result.filePaths[0]
    },
    'fs:read-dir': async (_event, payload) => {
      const entries = await readdir(resolveFilePath(payload), { withFileTypes: true }).catch(
        () => [],
      )
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }))
    },
    'fs:read-text-file': (_event, payload) => {
      return readFile(resolveFilePath(payload), 'utf8')
    },
    'fs:read-file': async (_event, payload) => {
      return [...(await readFile(resolveFilePath(payload)))]
    },
    'fs:exists': (_event, payload) => {
      return existsSync(resolveFilePath(payload))
    },
    'fs:remove': async (_event, payload) => {
      const targetPath = resolveFilePath(payload)
      if (isRecord(payload) && payload.recursive === true) {
        await rm(targetPath, { recursive: true, force: true })
        return
      }

      await rm(targetPath, { force: true })
    },
    'path:app-config-dir': (_event, payload) => {
      assertNoPayload(payload)
      return app.getPath('userData')
    },
    'path:app-cache-dir': async (_event, payload) => {
      assertNoPayload(payload)
      const cachePath = path.join(app.getPath('userData'), 'Cache')
      await mkdir(cachePath, { recursive: true })
      return cachePath
    },
    'hotkey:register': (_event, payload) => {
      const { name, shortcut } = assertShortcutPayload(payload)
      return name ? registerGlobalShortcutByName(name, shortcut) : false
    },
    'hotkey:unregister': (_event, payload) => {
      const { shortcut } = assertShortcutPayload(payload)
      unregisterGlobalShortcut(shortcut)
    },
    'hotkey:is-registered': (_event, payload) => {
      const { shortcut } = assertShortcutPayload(payload)
      return isGlobalShortcutRegistered(shortcut)
    },
    'command:invoke': async (_event, payload) => {
      const { command, payload: args } = assertCommandPayload(payload)

      switch (command) {
        case 'register_shortcut_by_frontend':
          if (!args || typeof args.name !== 'string' || typeof args.shortcut !== 'string') {
            throw new NeoPotError({
              code: 'IPC_INVALID_PAYLOAD',
              message: 'Expected name and shortcut.',
            })
          }
          return registerGlobalShortcutByName(args.name, args.shortcut)
        case 'screenshot':
          await captureDisplayForPoint({
            x: Number(args?.x ?? 0),
            y: Number(args?.y ?? 0),
          })
          return getCaptureDataUrl()
        case 'cut_image':
          return getCroppedBase64({
            x: Number(args?.left ?? 0),
            y: Number(args?.top ?? 0),
            width: Number(args?.width ?? 0),
            height: Number(args?.height ?? 0),
          })
        case 'screenshot_complete':
          if (getCurrentScreenshotAction() === 'translate') {
            await imageTranslate()
          } else {
            await recognizeWindow()
          }
          return undefined
        case 'get_base64':
          return getLastCroppedBase64()
        case 'copy_img': {
          const dataUrl = getLastCroppedDataUrl() || getCaptureDataUrl()
          if (dataUrl) {
            clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
          }
          return undefined
        }
        case 'get_text':
          return getCurrentWorkflowText()
        case 'translate_text':
          return textTranslate(assertTextPayload(args))
        case 'lang_detect':
          return detectLanguage(assertTextPayload(args))
        case 'http_request':
          return rendererHttpRequest(args)
        case 'font_list':
          return listSystemFonts()
        case 'update_tray':
          updateTrayMenu()
          return undefined
        case 'updater_window':
          await openUpdater()
          return undefined
        case 'open_url':
          await shell.openExternal(assertUrlPayload(args))
          return undefined
        case 'open_log_dir':
          await shell.openPath(app.getPath('logs'))
          return undefined
        case 'open_config_dir':
          await shell.openPath(app.getPath('userData'))
          return undefined
        case 'set_proxy':
        case 'unset_proxy':
          return true
        case 'open_devtools':
          BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: 'detach' })
          return undefined
        case 'reload_store':
          return undefined
        case 'log:set-level': {
          const level =
            args && typeof args === 'object' && 'level' in args ? String(args.level) : ''
          if (!isLogLevel(level)) {
            throw new NeoPotError({
              code: 'IPC_INVALID_PAYLOAD',
              message: `Invalid log level: ${level}`,
            })
          }
          const transportLevel = toLogTransportLevel(level)
          setMainLogTransportLevel(transportLevel)
          logger.info('Log level changed.', {
            level,
          })
          return true
        }
        case 'log:get-level':
          return getMainLogTransportLevel()
        default:
          throw new NeoPotError({
            code: 'IPC_UNKNOWN_CHANNEL',
            message: `Unsupported command: ${command}`,
          })
      }
    },
    'config:get': (_event, payload) => {
      const { key } = assertKeyPayload(payload)
      return getRedactedConfig(key)
    },
    'config:set': async (_event, payload) => {
      const { key, value } = assertKeyPayload(payload)
      await setConfig(key, value)
      broadcastAppEvent('config:changed', { key })
      logger.info('Config value change broadcasted.', {
        key,
      })
    },
    'workflow:selection-translate': (_event, payload) => {
      assertNoPayload(payload)
      return selectionTranslate()
    },
    'workflow:input-translate': (_event, payload) => {
      assertNoPayload(payload)
      return inputTranslate()
    },
    'workflow:ocr-recognize': (_event, payload) => {
      assertNoPayload(payload)
      return ocrRecognize()
    },
    'workflow:ocr-translate': (_event, payload) => {
      assertNoPayload(payload)
      return ocrTranslate()
    },
    'services:translate': (_event, payload) => {
      if (!isRecord(payload)) {
        throw new NeoPotError({
          code: 'IPC_INVALID_PAYLOAD',
          message: 'Expected a translation request object.',
        })
      }

      return translateService(payload)
    },
    'plugins:install': (_event, payload) => {
      const { file } = assertPluginInstallPayload(payload)
      return installPlugin(file)
    },
    'plugins:install-url': (_event, payload) => {
      const { url } = assertPluginInstallUrlPayload(payload)
      return installPluginFromUrl(url)
    },
    'plugins:inspect-source': (_event, payload) => {
      const { url } = assertPluginInstallUrlPayload(payload)
      return readPluginManifestFromSource(url)
    },
    'plugins:list': (_event, payload) => {
      const { type } = assertPluginListPayload(payload)
      return listInstalledPlugins(type)
    },
    'plugins:list-installed': (_event, payload) => {
      const { type } = assertOptionalPluginListPayload(payload)
      return listInstalledPlugins(type)
    },
    'plugins:uninstall': (_event, payload) => {
      const { type, name } = assertPluginIdentityPayload(payload)
      return uninstallPlugin(type, name)
    },
    'plugins:set-enabled': (_event, payload) => {
      const { type, name, enabled } = assertPluginEnabledPayload(payload)
      return setPluginEnabled(type, name, enabled)
    },
    'plugins:open-folder': async (_event, payload) => {
      assertNoPayload(payload)
      await mkdir(pluginRoot(), { recursive: true })
      return shell.openPath(pluginRoot())
    },
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        return await handler(event, payload)
      } catch (error) {
        const normalizedError = normalizeError(error)
        const command =
          isRecord(payload) && typeof payload.command === 'string' ? payload.command : undefined
        logger.error('IPC handler failed.', {
          channel,
          command,
          code: normalizedError.code,
          message: normalizedError.message,
          ...summarizePayloadForLog(payload),
        })
        throw normalizedError
      }
    })
  }
}
