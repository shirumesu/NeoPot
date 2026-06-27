import { openWindow, sendToWindow } from './window'
import { readSelectedText } from './selection'
import { logger } from '../logger'
import type { TranslateWorkflowPayload } from '../../shared/translateWorkflow'

let currentWorkflowText = ''
let currentScreenshotAction: 'recognize' | 'translate' = 'recognize'
let selectionTranslateInFlight: Promise<void> | null = null

export function getCurrentWorkflowText(): string {
  return currentWorkflowText
}

export function getCurrentScreenshotAction(): 'recognize' | 'translate' {
  return currentScreenshotAction
}

export async function openConfig(): Promise<void> {
  logger.debug('Opening config window.')
  await openWindow('config')
}

export async function openTranslate(): Promise<void> {
  logger.debug('Opening translate window.')
  await openWindow('translate')
}

export async function openUpdater(): Promise<void> {
  logger.debug('Opening updater window.')
  await openWindow('updater')
}

async function sendTranslateWorkflow(payload: TranslateWorkflowPayload): Promise<void> {
  const text =
    payload.kind === 'text'
      ? payload.text
      : payload.kind === 'selection' && payload.capture.ok
        ? payload.capture.text
        : ''

  logger.debug('Opening text translation workflow.', {
    textLength: text.length,
    kind: payload.kind,
  })
  currentWorkflowText = text
  await openWindow('translate')
  sendToWindow('translate', 'new_text', payload)
}

export async function textTranslate(text: string): Promise<void> {
  await sendTranslateWorkflow({
    kind: 'text',
    text,
  })
}

async function runSelectionTranslate(): Promise<void> {
  logger.debug('Selection translation workflow requested.')
  const capture = await readSelectedText()
  if (!capture.ok) {
    logger.debug('Selection translation did not capture text.', {
      reason: capture.reason,
      method: capture.method,
    })
  }

  await sendTranslateWorkflow({
    kind: 'selection',
    capture,
  })
}

export function selectionTranslate(): Promise<void> {
  if (selectionTranslateInFlight) {
    logger.debug('Selection translation workflow already in progress.')
    return selectionTranslateInFlight
  }

  const run = runSelectionTranslate().finally(() => {
    if (selectionTranslateInFlight === run) {
      selectionTranslateInFlight = null
    }
  })
  selectionTranslateInFlight = run
  return run
}

export async function inputTranslate(): Promise<void> {
  logger.debug('Input translation workflow requested.')
  await sendTranslateWorkflow({
    kind: 'input',
  })
}

export async function imageTranslate(): Promise<void> {
  logger.debug('Image translation workflow requested.')
  await sendTranslateWorkflow({
    kind: 'image',
  })
}

export async function recognizeWindow(): Promise<void> {
  logger.debug('Opening recognize window workflow.')
  currentWorkflowText = ''
  await openWindow('recognize')
  sendToWindow('recognize', 'new_image', '')
}

export async function ocrRecognize(): Promise<void> {
  logger.debug('OCR recognize workflow requested.')
  currentScreenshotAction = 'recognize'
  await openWindow('screenshot')
  sendToWindow('screenshot', 'capture_screenshot', 'recognize')
}

export async function ocrTranslate(): Promise<void> {
  logger.debug('OCR translate workflow requested.')
  currentScreenshotAction = 'translate'
  await openWindow('screenshot')
  sendToWindow('screenshot', 'capture_screenshot', 'translate')
}
