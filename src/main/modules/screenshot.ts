import { desktopCapturer, nativeImage, screen } from 'electron'
import { RENDERER_HOST, RENDERER_SCHEME, SCREENSHOT_PATH } from './rendererProtocol'

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

let lastCapture = nativeImage.createEmpty()
let lastCropped = nativeImage.createEmpty()
let lastScaleFactor = 1
let captureVersion = 0

export async function captureDisplayForPoint(point: Point): Promise<void> {
  const display = screen.getDisplayNearestPoint(point) ?? screen.getPrimaryDisplay()
  lastScaleFactor = display.scaleFactor
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  })
  const source =
    sources.find((candidate) => candidate.display_id === String(display.id)) ?? sources[0]

  if (!source) {
    throw new Error('No screenshot source is available.')
  }

  lastCapture = source.thumbnail
  lastCropped = nativeImage.createEmpty()
  captureVersion += 1
}

export function cropCapture(rect: Rect): void {
  if (lastCapture.isEmpty()) {
    throw new Error('No display capture is cached.')
  }

  lastCropped = lastCapture.crop({
    x: Math.round(rect.x * lastScaleFactor),
    y: Math.round(rect.y * lastScaleFactor),
    width: Math.round(rect.width * lastScaleFactor),
    height: Math.round(rect.height * lastScaleFactor),
  })
}

export function getCaptureUrl(): string {
  if (lastCapture.isEmpty()) {
    return ''
  }

  return `${RENDERER_SCHEME}://${RENDERER_HOST}${SCREENSHOT_PATH}?v=${captureVersion}`
}

export function getCapturePng(requestedVersion = captureVersion): Buffer {
  if (lastCapture.isEmpty() || requestedVersion !== captureVersion) {
    return Buffer.alloc(0)
  }

  return lastCapture.toPNG()
}

export function getLastCroppedBase64(): string {
  if (lastCropped.isEmpty()) {
    return ''
  }

  return lastCropped.toPNG().toString('base64')
}

export function getClipboardImage() {
  return lastCropped.isEmpty() ? lastCapture : lastCropped
}
