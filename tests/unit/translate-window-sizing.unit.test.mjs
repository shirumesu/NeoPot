import assert from 'node:assert/strict'
import { test } from 'vitest'

import { calculateAdaptiveTranslateWindowSize } from '../../src/shared/translateWindowSizing.ts'

const workArea = {
  width: 1920,
  height: 1080,
}

test('adaptive translate window sizing keeps short text close to the compact default', () => {
  assert.deepEqual(
    calculateAdaptiveTranslateWindowSize({
      text: 'hello',
      workArea,
      fontSize: 16,
    }),
    {
      width: 380,
      height: 420,
    },
  )
})

test('adaptive translate window sizing grows for long text without reaching the full display', () => {
  const size = calculateAdaptiveTranslateWindowSize({
    text: Array.from({ length: 30 }, (_, index) => `This is sentence number ${index + 1}.`).join(
      ' ',
    ),
    workArea,
    fontSize: 16,
  })

  assert.equal(size.width, 640)
  assert.ok(size.height >= 640, `expected a tall reading window, got ${size.height}`)
  assert.ok(size.height <= 800, `expected bounded height, got ${size.height}`)
})

test('adaptive translate window sizing respects small display work areas', () => {
  const size = calculateAdaptiveTranslateWindowSize({
    text: 'A long line of selected text that should adapt while staying inside the display.',
    workArea: {
      width: 500,
      height: 520,
    },
    fontSize: 16,
  })

  assert.equal(size.width, 420)
  assert.ok(size.height >= 420, `expected usable minimum height, got ${size.height}`)
  assert.ok(size.height <= 440, `expected height to stay inside small display, got ${size.height}`)
})
