import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => {
  class FakeNativeImage {
    constructor(
      private readonly png: Buffer,
      private readonly empty = false,
    ) {}

    isEmpty() {
      return this.empty
    }

    crop(rect: { x: number; y: number; width: number; height: number }) {
      return new FakeNativeImage(Buffer.from(JSON.stringify(rect)))
    }

    toPNG() {
      return this.png
    }
  }

  const display = {
    id: 7,
    scaleFactor: 2,
    size: { width: 100, height: 80 },
  }
  const capture = new FakeNativeImage(Buffer.from('full capture'))
  return {
    capture,
    createEmpty: vi.fn(() => new FakeNativeImage(Buffer.alloc(0), true)),
    getDisplayNearestPoint: vi.fn(() => display),
    getPrimaryDisplay: vi.fn(() => display),
    getSources: vi.fn(async () => [{ display_id: '7', thumbnail: capture }]),
  }
})

vi.mock('electron', () => ({
  desktopCapturer: { getSources: electronMock.getSources },
  nativeImage: { createEmpty: electronMock.createEmpty },
  screen: {
    getDisplayNearestPoint: electronMock.getDisplayNearestPoint,
    getPrimaryDisplay: electronMock.getPrimaryDisplay,
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('Main screenshot transport', () => {
  it('exposes a versioned neopot URL while retaining the capture as PNG bytes', async () => {
    const screenshot = await import('../../src/main/modules/screenshot')

    await screenshot.captureDisplayForPoint({ x: 10, y: 20 })

    expect(electronMock.getSources).toHaveBeenCalledWith({
      types: ['screen'],
      thumbnailSize: { width: 200, height: 160 },
    })
    expect(screenshot.getCaptureUrl()).toBe('neopot://main_window/__runtime/screenshot.png?v=1')
    expect(screenshot.getCapturePng()).toEqual(Buffer.from('full capture'))
    expect(screenshot.getCapturePng(0)).toEqual(Buffer.alloc(0))
  })

  it('keeps crop bytes in Main until an OCR consumer explicitly requests base64', async () => {
    const screenshot = await import('../../src/main/modules/screenshot')

    await screenshot.captureDisplayForPoint({ x: 10, y: 20 })
    expect(
      screenshot.cropCapture({
        x: 2,
        y: 3,
        width: 4,
        height: 5,
      }),
    ).toBeUndefined()

    const expectedCrop = { x: 4, y: 6, width: 8, height: 10 }
    expect(screenshot.getLastCroppedBase64()).toBe(
      Buffer.from(JSON.stringify(expectedCrop)).toString('base64'),
    )
    expect(screenshot.getClipboardImage()).not.toBe(electronMock.capture)
  })
})
