import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.neopot.neopot')
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

  const gotSingleInstanceLock = app.requestSingleInstanceLock()

  if (!gotSingleInstanceLock) {
    app.quit()
  } else {
    void startApp()
  }
}

async function startApp(): Promise<void> {
  const [clipboard, config, database, hotkey, ipc, server, tray, windowModule] = await Promise.all([
    import('./modules/clipboard'),
    import('./modules/config'),
    import('./modules/database'),
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
    await config.initializeConfig()
    database.runMigrations()
    await windowModule.openWindow('config')
    tray.setupTray()
    hotkey.registerGlobalShortcuts('all')
    clipboard.startClipboardMonitor()
    clipboard.setClipboardMonitorEnabled(false)
    server.startServer()

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
      console.error('Failed to run Squirrel Update.exe.', error)
    }
  }

  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      installSquirrelAppIcon(installedIconPath)
      runUpdateExe([
        '--createShortcut',
        exeName,
        '--shortcut-locations=Desktop,StartMenu',
      ])
      setTimeout(() => app.quit(), 1000)
      return true
    case '--squirrel-uninstall':
      removeSquirrelAppIcon(installedIconPath)
      runUpdateExe([
        '--removeShortcut',
        exeName,
        '--shortcut-locations=Desktop,StartMenu',
      ])
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
    console.error('Failed to install Squirrel app.ico.', error)
  }
}

function removeSquirrelAppIcon(installedIconPath: string): void {
  try {
    rmSync(installedIconPath, { force: true })
  } catch (error) {
    console.error('Failed to remove Squirrel app.ico.', error)
  }
}
