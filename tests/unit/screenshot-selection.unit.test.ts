import { describe, expect, it } from 'vitest'

import { calculateCropRect } from '../../src/renderer/windows/Screenshot/selection'

describe('screenshot selection geometry', () => {
  it('converts a forward drag into the cut_image payload shape', () => {
    expect(calculateCropRect({ x: 100, y: 50 }, { x: 300, y: 200 }, 1920, 1920)).toEqual({
      left: 100,
      top: 50,
      width: 200,
      height: 150,
    })
  })

  it('normalizes a reverse drag before calculating its size', () => {
    expect(calculateCropRect({ x: 300, y: 200 }, { x: 100, y: 50 }, 1920, 1920)).toEqual({
      left: 100,
      top: 50,
      width: 200,
      height: 150,
    })
  })

  it('maps viewport coordinates into the monitor logical coordinate space once', () => {
    expect(calculateCropRect({ x: 10, y: 20 }, { x: 110, y: 70 }, 1280, 1920)).toEqual({
      left: 15,
      top: 30,
      width: 150,
      height: 75,
    })
  })

  it('floors scaled edges before deriving fractional selection dimensions', () => {
    expect(calculateCropRect({ x: 1.9, y: 2.1 }, { x: 5.2, y: 7.9 }, 100, 125)).toEqual({
      left: 2,
      top: 2,
      width: 4,
      height: 7,
    })
  })

  it.each([
    [
      { x: 10, y: 10 },
      { x: 10, y: 30 },
    ],
    [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
    ],
    [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
  ])('rejects a selection that rounds to zero width or height', (start, end) => {
    expect(calculateCropRect(start, end, 100, 100)).toBeNull()
  })

  it.each([
    [0, 1920],
    [-1, 1920],
    [Number.NaN, 1920],
    [Number.POSITIVE_INFINITY, 1920],
    [1920, 0],
    [1920, -1],
    [1920, Number.NaN],
    [1920, Number.NEGATIVE_INFINITY],
  ])('rejects invalid viewport or monitor widths (%s, %s)', (viewportWidth, monitorWidth) => {
    expect(
      calculateCropRect({ x: 10, y: 10 }, { x: 20, y: 20 }, viewportWidth, monitorWidth),
    ).toBeNull()
  })

  it('rejects non-finite pointer coordinates', () => {
    expect(calculateCropRect({ x: Number.NaN, y: 10 }, { x: 20, y: 20 }, 100, 100)).toBeNull()
  })
})
