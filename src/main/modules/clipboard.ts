import { clipboard } from 'electron';
import { selectionTranslate } from './workflow';

let timer: ReturnType<typeof setInterval> | null = null;
let lastText = '';
let enabled = false;

export function startClipboardMonitor(): void {
    if (timer) {
        return;
    }

    enabled = true;
    lastText = clipboard.readText();
    timer = setInterval(() => {
        if (!enabled) {
            return;
        }

        try {
            const nextText = clipboard.readText();
            if (nextText && nextText !== lastText) {
                lastText = nextText;
                void selectionTranslate();
            }
        } catch (error) {
            enabled = false;
            console.warn('Clipboard monitor paused after failure:', error);
        }
    }, 500);
}

export function stopClipboardMonitor(): void {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    enabled = false;
}

export function setClipboardMonitorEnabled(nextEnabled: boolean): void {
    enabled = nextEnabled;
}
