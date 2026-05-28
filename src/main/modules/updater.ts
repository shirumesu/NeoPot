import { autoUpdater } from 'electron-updater';

export async function checkForUpdates(): Promise<unknown> {
    return autoUpdater.checkForUpdates();
}

export async function downloadUpdate(): Promise<string[]> {
    return autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
    autoUpdater.quitAndInstall();
}
