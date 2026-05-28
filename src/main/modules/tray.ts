import path from 'node:path';
import { Menu, nativeImage, Tray } from 'electron';
import { inputTranslate, ocrRecognize, ocrTranslate, openConfig, selectionTranslate } from './workflow';

let tray: Tray | null = null;

export function setupTray(): void {
    if (tray) {
        return;
    }

    const icon = nativeImage.createFromPath(path.join(process.cwd(), 'public/icon.png'));
    tray = new Tray(icon);
    tray.setToolTip('NeoPot');
    updateTrayMenu();
}

export function updateTrayMenu(): void {
    if (!tray) {
        return;
    }

    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: 'Config',
                click: () => void openConfig(),
            },
            {
                label: 'Selection Translate',
                click: () => void selectionTranslate(),
            },
            {
                label: 'Input Translate',
                click: () => void inputTranslate(),
            },
            {
                label: 'OCR Recognize',
                click: () => void ocrRecognize(),
            },
            {
                label: 'OCR Translate',
                click: () => void ocrTranslate(),
            },
        ])
    );
}
