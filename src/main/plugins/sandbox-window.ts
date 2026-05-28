import { BrowserWindow } from 'electron';

export function createPluginSandbox(pluginId: string): BrowserWindow {
    const window = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            sandbox: true,
            contextIsolation: true,
        },
    });

    void window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`<html><body data-plugin-id="${pluginId}"></body></html>`)}`
    );

    return window;
}

export function disposePluginSandbox(window: BrowserWindow): void {
    if (!window.isDestroyed()) {
        window.close();
    }
}
