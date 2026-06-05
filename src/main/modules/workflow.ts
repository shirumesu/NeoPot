import { openWindow, sendToWindow } from './window'
import { readSelectedText } from './selection'
import { logger } from '../logger'

let currentWorkflowText = ''
let currentScreenshotAction: 'recognize' | 'translate' = 'recognize'

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

export async function textTranslate(text: string): Promise<void> {
  logger.debug('Opening text translation workflow.', {
    textLength: text.length,
  })
  currentWorkflowText = text
  await openWindow('translate')
  sendToWindow('translate', 'new_text', text)
}

export async function selectionTranslate(): Promise<void> {
  logger.debug('Selection translation workflow requested.')
  const text = await readSelectedText()
  if (text.trim() === '') {
    logger.debug('Selection translation opened empty input.')
    await openWindow('translate')
    return
  }

  await textTranslate(text)
}

export async function inputTranslate(): Promise<void> {
  logger.debug('Input translation workflow requested.')
  await textTranslate('[INPUT_TRANSLATE]')
}

export async function imageTranslate(): Promise<void> {
  logger.debug('Image translation workflow requested.')
  await textTranslate('[IMAGE_TRANSLATE]')
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
