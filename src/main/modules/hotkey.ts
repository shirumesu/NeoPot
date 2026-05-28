import { globalShortcut } from 'electron';
import { inputTranslate, ocrRecognize, ocrTranslate, selectionTranslate } from './workflow';
import { getConfig, setConfig } from './config';

const defaultShortcuts: Record<string, { handler: () => void | Promise<void> }> = {
    hotkey_selection_translate: {
        handler: selectionTranslate,
    },
    hotkey_input_translate: {
        handler: inputTranslate,
    },
    hotkey_ocr_recognize: {
        handler: ocrRecognize,
    },
    hotkey_ocr_translate: {
        handler: ocrTranslate,
    },
};

export function registerGlobalShortcuts(scope: 'all' | string = 'all'): void {
    const entries =
        scope === 'all'
            ? Object.entries(defaultShortcuts)
            : Object.entries(defaultShortcuts).filter(([name]) => name === scope);

    for (const [name, shortcut] of entries) {
        const accelerator = getShortcutAccelerator(name);
        if (!accelerator) {
            continue;
        }

        const registered = globalShortcut.register(accelerator, () => {
            void shortcut.handler();
        });

        if (!registered) {
            console.warn(`Failed to register global shortcut: ${name}`);
        }
    }
}

export function unregisterGlobalShortcuts(): void {
    globalShortcut.unregisterAll();
}

export function getShortcutAccelerator(name: string): string {
    if (!(name in defaultShortcuts)) {
        return '';
    }

    const value = getConfig(name);
    return typeof value === 'string' ? value.trim() : '';
}

export function registerGlobalShortcutByName(name: string, accelerator: string): boolean {
    const shortcut = defaultShortcuts[name];
    const normalizedAccelerator = accelerator.trim();

    if (!shortcut || !normalizedAccelerator) {
        return false;
    }

    const previousAccelerator = getShortcutAccelerator(name);
    if (previousAccelerator) {
        globalShortcut.unregister(previousAccelerator);
    }

    const registered = globalShortcut.register(normalizedAccelerator, () => {
        void shortcut.handler();
    });

    if (registered) {
        setConfig(name, normalizedAccelerator);
    }

    return registered;
}

export function unregisterGlobalShortcut(accelerator: string): void {
    if (accelerator.trim()) {
        globalShortcut.unregister(accelerator.trim());
    }
}

export function isGlobalShortcutRegistered(accelerator: string): boolean {
    return accelerator.trim() ? globalShortcut.isRegistered(accelerator.trim()) : false;
}
