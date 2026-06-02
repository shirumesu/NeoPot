import { app, BrowserWindow, protocol } from 'electron'
import log from 'electron-log/main'
import { spawn } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { APP_USER_MODEL_ID } from './modules/appIdentity'
import { RENDERER_SCHEME } from './modules/rendererProtocol'
import { logger } from './logger'
import { isLogLevel, toLogTransportLevel, type AppLogLevel } from '../shared/logLevel'

log.initialize()

const defaultLogLevel: AppLogLevel = app.isPackaged ? 'info' : 'debug'
log.transports.file.level = defaultLogLevel
log.transports.console.level = defaultLogLevel

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID)
}

const squirrelStartupHandled = handleSquirrelStartupEvent()

if (squirrelStartupHandled) {
  app.quit()
} else {
  if (!app.isPackaged) {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
    app.commandLine.appendSwitch('disable-gpu-sandbox')
    app.commandLine.appendSwitch('in-process-gpu')
    app.commandLine.appendSwitch('no-sandbox')
  }

  // Register the renderer scheme before the app is ready so packaged windows
  // can load over `neopot://` (a non-`file:` origin) instead of `file:`.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: RENDERER_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ])

  const gotSingleInstanceLock = app.requestSingleInstanceLock()

  if (!gotSingleInstanceLock) {
    app.quit()
  } else {
    void startApp()
  }
}

async function startApp(): Promise<void> {
  const [clipboard, config, hotkey, ipc, server, tray, windowModule] = await Promise.all([
    import('./modules/clipboard'),
    import('./modules/config'),
    import('./modules/hotkey'),
    import('./modules/ipc'),
    import('./modules/server'),
    import('./modules/tray'),
    import('./modules/window'),
  ])

  ipc.registerIpcHandlers({
    getWindowLabel: (event) => windowModule.getCurrentWindowLabel(event.sender),
  })

  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) {
        window.restore()
      }
      window.focus()
    }
  })

  app.whenReady().then(async () => {
    windowModule.registerRendererProtocol()
    await config.initializeConfig()

    const persistedLevel = config.getConfig('log_level')
    if (isLogLevel(persistedLevel)) {
      const transportLevel = toLogTransportLevel(persistedLevel)
      log.transports.file.level = transportLevel
      log.transports.console.level = transportLevel
    } else {
      await config.setConfig('log_level', defaultLogLevel)
    }

    await windowModule.openWindow('config')
    tray.setupTray()
    hotkey.registerGlobalShortcuts('all')
    clipboard.startClipboardMonitor()
    clipboard.setClipboardMonitorEnabled(false)

    const configuredServerPort = config.getConfig('server_port')
    const serverPort =
      typeof configuredServerPort === 'number' &&
      Number.isInteger(configuredServerPort) &&
      configuredServerPort >= 0 &&
      configuredServerPort <= 65535
        ? configuredServerPort
        : undefined
    server.startServer(serverPort)

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await windowModule.openWindow('config')
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    windowModule.markAppQuitting()
  })

  app.on('will-quit', () => {
    hotkey.unregisterGlobalShortcuts()
    server.stopServer()
  })
}

function handleSquirrelStartupEvent(): boolean {
  if (process.platform !== 'win32') {
    return false
  }

  const squirrelEvent = process.argv[1]
  if (!squirrelEvent?.startsWith('--squirrel-')) {
    return false
  }

  const appFolder = path.dirname(process.execPath)
  const rootAppFolder = path.resolve(appFolder, '..')
  const updateExe = path.join(rootAppFolder, 'Update.exe')
  const exeName = path.basename(process.execPath)
  const installedIconPath = path.join(rootAppFolder, 'app.ico')

  const runUpdateExe = (args: string[]) => {
    try {
      spawn(updateExe, args, {
        detached: true,
        windowsHide: true,
      }).unref()
    } catch (error) {
      logger.error('Failed to run Squirrel Update.exe.', error, {
        args,
      })
    }
  }

  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      installSquirrelAppIcon(installedIconPath)
      runUpdateExe(['--createShortcut', exeName, '--shortcut-locations=Desktop,StartMenu'])
      setTimeout(() => app.quit(), 1000)
      return true
    case '--squirrel-uninstall':
      removeSquirrelAppIcon(installedIconPath)
      runUpdateExe(['--removeShortcut', exeName, '--shortcut-locations=Desktop,StartMenu'])
      setTimeout(() => app.quit(), 1000)
      return true
    case '--squirrel-obsolete':
      return true
    default:
      return false
  }
}

function installSquirrelAppIcon(installedIconPath: string): void {
  try {
    copyFileSync(path.join(app.getAppPath(), 'public', 'icon.ico'), installedIconPath)
  } catch (error) {
    logger.error('Failed to install Squirrel app.ico.', error)
  }
}

function removeSquirrelAppIcon(installedIconPath: string): void {
  try {
    rmSync(installedIconPath, { force: true })
  } catch (error) {
    logger.error('Failed to remove Squirrel app.ico.', error)
  }
}
