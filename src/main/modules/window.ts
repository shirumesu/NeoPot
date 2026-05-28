import path from 'node:path';
import { BrowserWindow, Menu, screen, type BrowserWindowConstructorOptions, type WebContents } from 'electron';

export type WindowLabel = 'config' | 'translate' | 'recognize' | 'screenshot' | 'updater';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const windows = new Map<WindowLabel, BrowserWindow>();
const windowLabelsByWebContentsId = new Map<number, WindowLabel>();

interface WindowDefinition {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    skipTaskbar?: boolean;
    fullscreen?: boolean;
    alwaysOnTop?: boolean;
    transparent?: boolean;
    resizable?: boolean;
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
};

function rendererUrl(label: WindowLabel): string | null {
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        return null;
    }

    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    url.searchParams.set('window', label);
    return url.toString();
}

async function loadRenderer(window: BrowserWindow, label: WindowLabel) {
    const url = rendererUrl(label);
    if (url) {
        await window.loadURL(url);
        return;
    }

    await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
        query: {
            window: label,
        },
    });
}

function positionTranslateWindow(window: BrowserWindow) {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor) ?? screen.getPrimaryDisplay();
    const bounds = display.workArea;
    const [width, height] = window.getSize();

    const x = Math.max(bounds.x, Math.min(cursor.x, bounds.x + bounds.width - width));
    const y = Math.max(bounds.y, Math.min(cursor.y, bounds.y + bounds.height - height));
    window.setPosition(x, y);
}

function createBrowserWindow(label: WindowLabel): BrowserWindow {
    Menu.setApplicationMenu(null);

    const definition = windowDefinitions[label];
    const options: BrowserWindowConstructorOptions = {
        width: definition.width,
        height: definition.height,
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
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        },
    };

    const window = new BrowserWindow(options);
    const webContentsId = window.webContents.id;
    windows.set(label, window);
    windowLabelsByWebContentsId.set(webContentsId, label);

    window.once('ready-to-show', () => {
        if (label === 'translate') {
            positionTranslateWindow(window);
        } else if (label === 'config' || label === 'recognize' || label === 'updater') {
            window.center();
        }
        window.show();
        window.focus();
    });

    window.on('closed', () => {
        windows.delete(label);
        windowLabelsByWebContentsId.delete(webContentsId);
    });

    return window;
}

export async function openWindow(label: WindowLabel): Promise<BrowserWindow> {
    const existing = windows.get(label);
    if (existing && !existing.isDestroyed()) {
        focusWindow(label);
        return existing;
    }

    const window = createBrowserWindow(label);
    await loadRenderer(window, label);
    return window;
}

export function focusWindow(label: WindowLabel): void {
    const window = windows.get(label);
    if (!window || window.isDestroyed()) {
        return;
    }

    if (window.isMinimized()) {
        window.restore();
    }
    if (label === 'translate') {
        positionTranslateWindow(window);
    }
    window.show();
    window.focus();
}

export function sendToWindow(label: WindowLabel, event: string, payload: unknown): void {
    const window = windows.get(label);
    if (!window || window.isDestroyed()) {
        return;
    }

    window.webContents.send(event, payload);
}

export function getCurrentWindowLabel(webContents: WebContents): WindowLabel {
    return windowLabelsByWebContentsId.get(webContents.id) ?? 'config';
}

export function getWindow(label: WindowLabel): BrowserWindow | undefined {
    return windows.get(label);
}
