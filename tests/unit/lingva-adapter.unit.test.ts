import { describe, expect, it, vi } from 'vitest'

import { synthesizeLingva, type LingvaRequest } from '../../src/renderer/providers/tts/lingva/tts'

function response(data: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    data,
  }
}

describe('Lingva TTS adapter', () => {
  it('normalizes the custom origin, trims and encodes text, and returns validated audio bytes', async () => {
    const request: LingvaRequest = vi.fn(async () => response({ audio: [0, 1, 127, 255] }))

    await expect(
      synthesizeLingva(
        '  hello / 世界  ',
        'zh',
        { config: { custom_url: 'lingva.example.test/base/' } },
        { request },
      ),
    ).resolves.toEqual([0, 1, 127, 255])

    expect(request).toHaveBeenCalledWith(
      'https://lingva.example.test/base/api/v1/audio/zh/hello%20%2F%20%E4%B8%96%E7%95%8C',
      {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      },
    )
  })

  it('rejects empty input without calling the service', async () => {
    const request: LingvaRequest = vi.fn()

    await expect(synthesizeLingva('   ', 'en', {}, { request })).rejects.toThrow(
      'Cannot synthesize empty text.',
    )
    expect(request).not.toHaveBeenCalled()
  })

  it('reports HTTP failures with status details', async () => {
    const request: LingvaRequest = vi.fn(async () =>
      response({ error: 'unavailable' }, 503, 'Service Unavailable'),
    )

    await expect(synthesizeLingva('hello', 'en', {}, { request })).rejects.toThrow(
      'HTTP request failed: 503 Service Unavailable',
    )
  })

  it.each([undefined, null, [], [1.5], [-1], [256], ['1']])(
    'rejects malformed audio data: %j',
    async (audio) => {
      const request: LingvaRequest = vi.fn(async () => response({ audio }))

      await expect(synthesizeLingva('hello', 'en', {}, { request })).rejects.toThrow(
        'Lingva did not return audio data.',
      )
    },
  )
})
