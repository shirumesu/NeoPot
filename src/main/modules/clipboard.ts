import { clipboard } from 'electron'
import { logger } from '../logger'
import { selectionTranslate } from './workflow'
import {
  getSelectionClipboardCaptureBaseline,
  isSelectionClipboardCaptureActive,
} from './selection'

let timer: ReturnType<typeof setInterval> | null = null
let lastText = ''
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

  try {
    lastText = clipboard.readText()
  } catch (error) {
    logger.warn('Clipboard monitor could not start.', {
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }

  timer = setInterval(() => {
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
      stopClipboardMonitor()
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
}

export function setClipboardMonitorEnabled(nextEnabled: boolean): void {
  if (nextEnabled) {
    startClipboardMonitor()
  } else {
    stopClipboardMonitor()
  }
}
