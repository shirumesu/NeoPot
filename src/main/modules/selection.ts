import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { clipboard } from 'electron'
import { logger } from '../logger'

const execFileAsync = promisify(execFile)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const COPY_POLL_INTERVAL_MS = 30
const COPY_TIMEOUT_MS = 1000
let selectionClipboardCaptureDepth = 0
let selectionClipboardBaselineVersion = 0
let selectionClipboardBaselineText: string | null = null

export function isSelectionClipboardCaptureActive(): boolean {
  return selectionClipboardCaptureDepth > 0
}

export function getSelectionClipboardCaptureBaseline(): {
  version: number
  text: string | null
} {
  return {
    version: selectionClipboardBaselineVersion,
    text: selectionClipboardBaselineText,
  }
}

async function tryExecFile(file: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      windowsHide: true,
      timeout: 1000,
    })
    const text = stdout.trim()
    return text === '' ? null : text
  } catch {
    return null
  }
}

async function readLinuxPrimarySelection(): Promise<string | null> {
  return (
    (await tryExecFile('wl-paste', ['--primary', '--no-newline'])) ??
    (await tryExecFile('xclip', ['-selection', 'primary', '-out'])) ??
    (await tryExecFile('xsel', ['--primary', '--output']))
  )
}

async function sendLinuxCopyKeystroke(): Promise<void> {
  for (const [command, args] of [
    ['xdotool', ['key', 'ctrl+c']],
    ['wtype', ['-M', 'ctrl', 'c', '-m', 'ctrl']],
  ] as const) {
    try {
      await execFileAsync(command, args, {
        windowsHide: true,
        timeout: 1000,
      })
      return
    } catch {
      // Try the next common desktop helper.
    }
  }

  logger.warn('No supported Linux selection copy helper was available.')
}

async function sendMacCopyKeystroke(): Promise<void> {
  await execFileAsync(
    'osascript',
    ['-e', 'tell application "System Events" to keystroke "c" using command down'],
    {
      windowsHide: true,
      timeout: 2000,
    },
  )
}

async function sendCopyKeystroke(): Promise<void> {
  if (process.platform === 'linux') {
    await sendLinuxCopyKeystroke()
    return
  }

  if (process.platform === 'darwin') {
    await sendMacCopyKeystroke()
    return
  }

  if (process.platform !== 'win32') {
    return
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
    },
  )
}

async function waitForCopiedClipboardValue(marker: string): Promise<string | null> {
  const deadline = Date.now() + COPY_TIMEOUT_MS

  while (Date.now() < deadline) {
    await delay(COPY_POLL_INTERVAL_MS)
    const currentText = clipboard.readText()
    if (currentText !== marker) {
      return currentText
    }
  }

  return null
}

export async function readSelectedText(): Promise<string> {
  if (process.platform === 'linux') {
    const primarySelection = await readLinuxPrimarySelection()
    if (primarySelection) {
      return primarySelection
    }
  }

  const previousText = clipboard.readText()
  const marker = `__NEOPOT_SELECTION_${randomUUID()}__`
  let copiedClipboardValue: string | null = null

  selectionClipboardCaptureDepth += 1
  try {
    clipboard.writeText(marker)
    await sendCopyKeystroke()
    copiedClipboardValue = await waitForCopiedClipboardValue(marker)
    return copiedClipboardValue ?? ''
  } finally {
    try {
      const currentText = clipboard.readText()
      if (
        currentText === marker ||
        (copiedClipboardValue !== null && currentText === copiedClipboardValue)
      ) {
        clipboard.writeText(previousText)
      }
      selectionClipboardBaselineVersion += 1
      selectionClipboardBaselineText = clipboard.readText()
    } finally {
      selectionClipboardCaptureDepth -= 1
    }
  }
}
