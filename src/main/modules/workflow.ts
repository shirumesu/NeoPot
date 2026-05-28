import { openWindow, sendToWindow } from './window';
import { readSelectedText } from './selection';

let currentWorkflowText = '';

export function getCurrentWorkflowText(): string {
    return currentWorkflowText;
}

export async function openConfig(): Promise<void> {
    await openWindow('config');
}

export async function openUpdater(): Promise<void> {
    await openWindow('updater');
}

export async function textTranslate(text: string): Promise<void> {
    currentWorkflowText = text;
    await openWindow('translate');
    sendToWindow('translate', 'new_text', text);
}

export async function selectionTranslate(): Promise<void> {
    await textTranslate(await readSelectedText());
}

export async function inputTranslate(): Promise<void> {
    await textTranslate('[INPUT_TRANSLATE]');
}

export async function imageTranslate(): Promise<void> {
    await textTranslate('[IMAGE_TRANSLATE]');
}

export async function recognizeWindow(): Promise<void> {
    currentWorkflowText = '';
    await openWindow('recognize');
    sendToWindow('recognize', 'new_image', '');
}

export async function ocrRecognize(): Promise<void> {
    await openWindow('screenshot');
    sendToWindow('screenshot', 'capture_screenshot', 'recognize');
}

export async function ocrTranslate(): Promise<void> {
    await openWindow('screenshot');
    sendToWindow('screenshot', 'capture_screenshot', 'translate');
}
