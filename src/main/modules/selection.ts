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
const abortableDelay = (ms: number, signal?: AbortSignal): Promise<boolean> => {
  if (!signal) {
    return delay(ms).then(() => true)
  }
  if (signal.aborted) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve(true)
    }, ms)
    const abort = () => {
      clearTimeout(timeout)
      resolve(false)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}
const COPY_POLL_INTERVAL_MS = 30
const COPY_TIMEOUT_MS = 700
const COPY_SETTLE_DELAY_MS = 180
const COPY_RETRY_DELAY_MS = 120
const COPY_ATTEMPT_COUNT = 2
const WINDOWS_UIA_SELECTION_TIMEOUT_MS = 1200
const WINDOWS_UIA_SELECTION_COMMAND = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NeoPotForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
"@

function Get-TextPatternSelection($element) {
  if ($null -eq $element) {
    return $null
  }

  $pattern = $null
  if (-not $element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
    return $null
  }

  try {
    $ranges = $pattern.GetSelection()
  } catch {
    return $null
  }

  if ($null -eq $ranges) {
    return $null
  }

  $parts = New-Object 'System.Collections.Generic.List[string]'
  foreach ($range in $ranges) {
    try {
      $text = $range.GetText(-1)
    } catch {
      $text = $null
    }

    if (-not [string]::IsNullOrWhiteSpace($text)) {
      [void]$parts.Add($text.Trim())
    }
  }

  if ($parts.Count -eq 0) {
    return $null
  }

  return [string]::Join("\`n", $parts.ToArray())
}

function Write-SelectionAndExit($text) {
  if (-not [string]::IsNullOrWhiteSpace($text)) {
    [Console]::Write($text)
    exit 0
  }
}

$element = [System.Windows.Automation.AutomationElement]::FocusedElement
for ($i = 0; $i -lt 8 -and $null -ne $element; $i += 1) {
  Write-SelectionAndExit (Get-TextPatternSelection $element)
  $element = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($element)
}

$foregroundWindow = [NeoPotForegroundWindow]::GetForegroundWindow()
if ($foregroundWindow -ne [IntPtr]::Zero) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($foregroundWindow)
  if ($null -ne $root) {
    $condition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::IsTextPatternAvailableProperty,
      $true
    )
    $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, $condition)
    foreach ($candidate in $elements) {
      Write-SelectionAndExit (Get-TextPatternSelection $candidate)
    }
  }
}

exit 1
`
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

async function tryExecFile(file: string, args: string[], timeout = 1000): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      windowsHide: true,
      timeout,
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

async function sendWindowsCopyKeystroke(signal?: AbortSignal): Promise<CopyCommandResult> {
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
        signal,
      },
    )
    return { ok: true }
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, reason: 'copy-command-failed' }
    }
    logger.warn('Windows selection copy command failed.', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: 'copy-command-failed' }
  }
}

async function readWindowsUiaSelectedText(): Promise<string | null> {
  return tryExecFile(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', WINDOWS_UIA_SELECTION_COMMAND],
    WINDOWS_UIA_SELECTION_TIMEOUT_MS,
  )
}

async function readWindowsUiaSelection(): Promise<SelectionCaptureResult> {
  const text = await readWindowsUiaSelectedText()
  if (text && text.trim() !== '') {
    return {
      ok: true,
      text,
      method: 'windows-uia-selection',
    }
  }

  return {
    ok: false,
    reason: 'empty',
    method: 'windows-uia-selection',
  }
}

async function waitForCopiedClipboardValue(
  marker: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const deadline = Date.now() + COPY_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (!(await abortableDelay(COPY_POLL_INTERVAL_MS, signal))) {
      return null
    }
    const currentText = clipboard.readText()
    if (currentText !== marker) {
      return currentText
    }
  }

  return null
}

async function readClipboardFallbackSelection(
  method: SelectionCaptureMethod,
  copySelection: (signal?: AbortSignal) => Promise<CopyCommandResult>,
): Promise<SelectionCaptureResult>
async function readClipboardFallbackSelection(
  method: SelectionCaptureMethod,
  copySelection: (signal?: AbortSignal) => Promise<CopyCommandResult>,
  signal: AbortSignal,
): Promise<SelectionCaptureResult | null>
async function readClipboardFallbackSelection(
  method: SelectionCaptureMethod,
  copySelection: (signal?: AbortSignal) => Promise<CopyCommandResult>,
  signal?: AbortSignal,
): Promise<SelectionCaptureResult | null> {
  if (signal?.aborted) {
    return null
  }

  const previousText = clipboard.readText()
  const marker = `__NEOPOT_SELECTION_${randomUUID()}__`
  let copiedClipboardValue: string | null = null
  let result: SelectionCaptureResult | null = null

  selectionClipboardCaptureDepth += 1
  try {
    if (signal?.aborted) {
      return null
    }
    clipboard.writeText(marker)

    for (let attempt = 0; attempt < COPY_ATTEMPT_COUNT; attempt += 1) {
      if (
        (attempt > 0 && !(await abortableDelay(COPY_RETRY_DELAY_MS, signal))) ||
        !(await abortableDelay(COPY_SETTLE_DELAY_MS, signal))
      ) {
        return null
      }

      const copyResult = await copySelection(signal)
      if (signal?.aborted) {
        return null
      }
      if (!copyResult.ok) {
        result = {
          ok: false,
          reason: copyResult.reason,
          method,
        }
        return result
      }

      copiedClipboardValue = await waitForCopiedClipboardValue(marker, signal)
      if (signal?.aborted) {
        return null
      }
      if (copiedClipboardValue !== null) {
        break
      }
    }

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
  const fallbackAbortController = new AbortController()
  const uiaSelection = readWindowsUiaSelection().then((result) => {
    if (result.ok) {
      fallbackAbortController.abort()
    }
    return result
  })
  const clipboardFallback = readClipboardFallbackSelection(
    'windows-clipboard-fallback',
    sendWindowsCopyKeystroke,
    fallbackAbortController.signal,
  )

  const first = await Promise.race([uiaSelection, clipboardFallback])
  if (first === null) {
    return uiaSelection
  }
  if (first.ok) {
    if (first.method === 'windows-uia-selection') {
      await clipboardFallback
    }
    return first
  }

  if (first.method === 'windows-uia-selection') {
    return (await clipboardFallback) ?? first
  }

  const uiaResult = await uiaSelection
  return uiaResult.ok ? uiaResult : first
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
