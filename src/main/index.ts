import { app, BrowserWindow } from 'electron';

if (!app.isPackaged) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('in-process-gpu');
    app.commandLine.appendSwitch('no-sandbox');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    void startApp();
}

async function startApp(): Promise<void> {
    const [
        clipboard,
        config,
        database,
        hotkey,
        ipc,
        server,
        tray,
        windowModule,
    ] = await Promise.all([
        import('./modules/clipboard'),
        import('./modules/config'),
        import('./modules/database'),
        import('./modules/hotkey'),
        import('./modules/ipc'),
        import('./modules/server'),
        import('./modules/tray'),
        import('./modules/window'),
    ]);

    ipc.registerIpcHandlers({
        getWindowLabel: (event) => windowModule.getCurrentWindowLabel(event.sender),
    });

    app.on('second-instance', () => {
        const [window] = BrowserWindow.getAllWindows();
        if (window) {
            if (window.isMinimized()) {
                window.restore();
            }
            window.focus();
        }
    });

    app.whenReady().then(async () => {
        await config.initializeConfig();
        database.runMigrations();
        await windowModule.openWindow('config');
        tray.setupTray();
        hotkey.registerGlobalShortcuts('all');
        clipboard.startClipboardMonitor();
        clipboard.setClipboardMonitorEnabled(false);
        server.startServer();

        app.on('activate', async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                await windowModule.openWindow('config');
            }
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('will-quit', () => {
        hotkey.unregisterGlobalShortcuts();
        server.stopServer();
    });
}
