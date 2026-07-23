import { describe, expect, it } from 'vitest'

import { asRecord, errorMessage, responseMessage } from '../../src/renderer/providers/shared'

describe('provider shared response helpers', () => {
  it('only treats plain objects as records', () => {
    expect(asRecord({ value: 1 })).toEqual({ value: 1 })
    expect(asRecord(null)).toBeNull()
    expect(asRecord(['value'])).toBeNull()
  })

  it('normalizes thrown errors and fallback values', () => {
    expect(errorMessage(new Error('  unavailable  '))).toBe('unavailable')
    expect(errorMessage('  disconnected  ')).toBe('disconnected')
    expect(errorMessage(null)).toBe('Unknown request error.')
  })

  it('preserves provider-specific handling of direct error strings', () => {
    expect(responseMessage({ error: 'rate limited', message: 'fallback' })).toBe('fallback')
    expect(
      responseMessage({ error: 'rate limited', message: 'fallback' }, { directError: 'any' }),
    ).toBe('rate limited')
    expect(responseMessage({ error: { message: 'nested failure' } })).toBe('nested failure')
    expect(responseMessage({ error: {}, message: 'fallback' }, { directError: 'non-object' })).toBe(
      'fallback',
    )
    expect(responseMessage({ error: {}, message: 'fallback' }, { directError: 'any' })).toBe(
      'Unexpected response.',
    )
  })
})
