import { clipboard } from 'electron'
import { logger } from '../logger'
import { selectionTranslate } from './workflow'
import {
  getSelectionClipboardCaptureBaseline,
  isSelectionClipboardCaptureActive,
} from './selection'

let timer: ReturnType<typeof setInterval> | null = null
let lastText = ''
let enabled = false
let selectionClipboardBaselineVersion = 0

function syncSelectionClipboardBaseline(): boolean {
  const baseline = getSelectionClipboardCaptureBaseline()
  if (baseline.version === selectionClipboardBaselineVersion) {
    return false
  }

  selectionClipboardBaselineVersion = baseline.version
  if (baseline.text !== null) {
    lastText = baseline.text
  }
  return true
}

export function startClipboardMonitor(): void {
  if (timer) {
    return
  }

  enabled = true
  lastText = clipboard.readText()
  timer = setInterval(() => {
    if (!enabled) {
      return
    }

    try {
      if (isSelectionClipboardCaptureActive() || syncSelectionClipboardBaseline()) {
        return
      }

      const nextText = clipboard.readText()
      if (nextText && nextText !== lastText) {
        lastText = nextText
        void selectionTranslate()
      }
    } catch (error) {
      enabled = false
      logger.warn('Clipboard monitor paused after failure.', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, 500)
}

export function stopClipboardMonitor(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  enabled = false
}

export function setClipboardMonitorEnabled(nextEnabled: boolean): void {
  enabled = nextEnabled
}
