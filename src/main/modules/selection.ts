import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { clipboard } from 'electron';

const execFileAsync = promisify(execFile);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendCopyKeystroke(): Promise<void> {
    if (process.platform !== 'win32') {
        return;
    }

    await execFileAsync(
        'powershell.exe',
        [
            '-NoProfile',
            '-Command',
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
        ],
        {
            windowsHide: true,
            timeout: 2000,
        }
    );
}

export async function readSelectedText(): Promise<string> {
    const previousText = clipboard.readText();
    const marker = `__NEOPOT_SELECTION_${Date.now()}__`;

    try {
        clipboard.writeText(marker);
        await sendCopyKeystroke();
        await delay(120);
        const selectedText = clipboard.readText();
        return selectedText === marker ? '' : selectedText;
    } finally {
        if (previousText !== clipboard.readText()) {
            clipboard.writeText(previousText);
        }
    }
}
