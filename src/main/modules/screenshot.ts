import { desktopCapturer, nativeImage, screen } from 'electron'

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

let lastCapture = nativeImage.createEmpty()
let lastScaleFactor = 1

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
}

export function cropCapture(rect: Rect): string {
  if (lastCapture.isEmpty()) {
    throw new Error('No display capture is cached.')
  }

  const cropped = lastCapture.crop({
    x: Math.round(rect.x * lastScaleFactor),
    y: Math.round(rect.y * lastScaleFactor),
    width: Math.round(rect.width * lastScaleFactor),
    height: Math.round(rect.height * lastScaleFactor),
  })

  return cropped.toDataURL()
}

export function getCroppedBase64(rect: Rect): string {
  const base64 = cropCapture(rect).replace(/^data:image\/png;base64,/, '')
  lastCroppedBase64 = base64
  return base64
}

let lastCroppedBase64 = ''

export function getCaptureDataUrl(): string {
  if (lastCapture.isEmpty()) {
    return ''
  }

  return lastCapture.toDataURL()
}

export function getLastCroppedBase64(): string {
  return lastCroppedBase64
}

export function getLastCroppedDataUrl(): string {
  return lastCroppedBase64 ? `data:image/png;base64,${lastCroppedBase64}` : ''
}
