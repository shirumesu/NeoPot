import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { clipboard } from 'electron'
import { logger } from '../logger'
import type {
  SelectionCaptureFailureReason,
  SelectionCaptureMethod,
  SelectionCaptureResult,
} from '../../shared/translateWorkflow'

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

type CopyCommandResult =
  | {
      ok: true
    }
  | {
      ok: false
      reason: SelectionCaptureFailureReason
    }

async function readLinuxPrimarySelection(): Promise<string | null> {
  return (
    (await tryExecFile('wl-paste', ['--primary', '--no-newline'])) ??
    (await tryExecFile('xclip', ['-selection', 'primary', '-out'])) ??
    (await tryExecFile('xsel', ['--primary', '--output']))
  )
}

async function sendLinuxCopyKeystroke(): Promise<CopyCommandResult> {
  for (const [command, args] of [
    ['xdotool', ['key', 'ctrl+c']],
    ['wtype', ['-M', 'ctrl', 'c', '-m', 'ctrl']],
  ] as const) {
    try {
      await execFileAsync(command, args, {
        windowsHide: true,
        timeout: 1000,
      })
      return { ok: true }
    } catch {
      // Try the next common desktop helper.
    }
  }

  logger.warn('No supported Linux selection copy helper was available.')
  return { ok: false, reason: 'copy-helper-unavailable' }
}

async function sendMacCopyKeystroke(): Promise<CopyCommandResult> {
  try {
    await execFileAsync(
      'osascript',
      ['-e', 'tell application "System Events" to keystroke "c" using command down'],
      {
        windowsHide: true,
        timeout: 2000,
      },
    )
    return { ok: true }
  } catch (error) {
    logger.warn('macOS selection copy command failed.', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: 'copy-command-failed' }
  }
}

async function sendWindowsCopyKeystroke(): Promise<CopyCommandResult> {
  try {
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
    return { ok: true }
  } catch (error) {
    logger.warn('Windows selection copy command failed.', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: 'copy-command-failed' }
  }
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

async function readClipboardFallbackSelection(
  method: SelectionCaptureMethod,
  copySelection: () => Promise<CopyCommandResult>,
): Promise<SelectionCaptureResult> {
  const previousText = clipboard.readText()
  const marker = `__NEOPOT_SELECTION_${randomUUID()}__`
  let copiedClipboardValue: string | null = null
  let result: SelectionCaptureResult | null = null

  selectionClipboardCaptureDepth += 1
  try {
    clipboard.writeText(marker)
    const copyResult = await copySelection()
    if (!copyResult.ok) {
      result = {
        ok: false,
        reason: copyResult.reason,
        method,
      }
      return result
    }

    copiedClipboardValue = await waitForCopiedClipboardValue(marker)
    if (copiedClipboardValue === null) {
      result = {
        ok: false,
        reason: 'copy-timeout',
        method,
      }
      return result
    }

    if (copiedClipboardValue.trim() === '') {
      result = {
        ok: false,
        reason: 'empty',
        method,
      }
      return result
    }

    result = {
      ok: true,
      text: copiedClipboardValue,
      method,
    }
    return result
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

async function readLinuxSelectedText(): Promise<SelectionCaptureResult> {
  const primarySelection = await readLinuxPrimarySelection()
  if (primarySelection && primarySelection.trim() !== '') {
    return {
      ok: true,
      text: primarySelection,
      method: 'linux-primary-selection',
    }
  }

  return readClipboardFallbackSelection('linux-clipboard-fallback', sendLinuxCopyKeystroke)
}

async function readWindowsSelectedText(): Promise<SelectionCaptureResult> {
  return readClipboardFallbackSelection('windows-clipboard-fallback', sendWindowsCopyKeystroke)
}

async function readMacSelectedText(): Promise<SelectionCaptureResult> {
  return readClipboardFallbackSelection('macos-clipboard-fallback', sendMacCopyKeystroke)
}

export async function readSelectedText(): Promise<SelectionCaptureResult> {
  switch (process.platform) {
    case 'linux':
      return readLinuxSelectedText()
    case 'win32':
      return readWindowsSelectedText()
    case 'darwin':
      return readMacSelectedText()
    default:
      return {
        ok: false,
        reason: 'unsupported-platform',
        method: 'unsupported-clipboard-fallback',
      }
  }
}
