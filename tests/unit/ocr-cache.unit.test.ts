import { expect, it, vi } from 'vitest'

import { getOrCreateCachedOcr } from '../../src/renderer/providers/recognize/local_model/ocrCache'

it('evicts a failed OCR initialization so the next request can retry', async () => {
  const cache = new Map<string, Promise<{ predict: () => string }>>()
  const create = vi
    .fn<() => Promise<{ predict: () => string }>>()
    .mockRejectedValueOnce(new Error('model temporarily unavailable'))
    .mockResolvedValueOnce({ predict: () => 'Recovered' })

  await expect(getOrCreateCachedOcr(cache, 'en', create)).rejects.toThrow(
    'model temporarily unavailable',
  )
  await expect(getOrCreateCachedOcr(cache, 'en', create)).resolves.toMatchObject({
    predict: expect.any(Function),
  })

  expect(create).toHaveBeenCalledTimes(2)
})
