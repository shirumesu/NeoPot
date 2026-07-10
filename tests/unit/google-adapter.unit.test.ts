import { describe, expect, it, vi } from 'vitest'

import {
  translateGoogle,
  type GoogleRequest,
} from '../../src/renderer/providers/translate/google/translate'

function response(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    data,
  }
}

describe('Google translate adapter', () => {
  it('builds the normalized request and concatenates plain translation segments', async () => {
    const request: GoogleRequest = vi.fn(async () =>
      response([
        [
          [' hello ', 'source'],
          ['world ', 'source'],
        ],
      ]),
    )

    await expect(
      translateGoogle(
        'source text',
        'en',
        'zh-CN',
        { config: { custom_url: 'translate.example.test/base/' } },
        { request },
      ),
    ).resolves.toBe('hello world')

    expect(request).toHaveBeenCalledWith(
      'https://translate.example.test/base/translate_a/single?dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t',
      {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        query: {
          client: 'gtx',
          sl: 'en',
          tl: 'zh-CN',
          hl: 'zh-CN',
          ie: 'UTF-8',
          oe: 'UTF-8',
          otf: '1',
          ssel: '0',
          tsel: '0',
          kc: '7',
          q: 'source text',
        },
      },
    )
  })

  it('normalizes pronunciation, dictionary explanations, and example sentences', async () => {
    const data = Array.from({ length: 14 }, () => null) as unknown[]
    data[0] = [
      ['translated', 'source'],
      [null, null, null, '/həˈloʊ/'],
    ]
    data[1] = [
      ['noun', null, [['greeting'], ['salutation']]],
      ['verb', null, [['address someone']]],
    ]
    data[13] = [[['hello there'], ['hello world']]]
    const request: GoogleRequest = vi.fn(async () => response(data))

    await expect(translateGoogle('hello', 'en', 'fr', {}, { request })).resolves.toEqual({
      pronunciations: [{ symbol: '/həˈloʊ/', voice: '' }],
      explanations: [
        { trait: 'noun', explains: ['greeting', 'salutation'] },
        { trait: 'verb', explains: ['address someone'] },
      ],
      associations: [],
      sentence: [{ source: 'hello there' }, { source: 'hello world' }],
    })
  })

  it.each([null, {}, [], [[]], [[null]], [[], []]])(
    'rejects malformed successful data instead of throwing an incidental TypeError',
    async (data) => {
      const request: GoogleRequest = vi.fn(async () => response(data))

      await expect(translateGoogle('hello', 'en', 'fr', {}, { request })).rejects.toThrow(
        'Google returned an empty or malformed translation response.',
      )
    },
  )

  it('reports an HTTP failure with the provider message', async () => {
    const request: GoogleRequest = vi.fn(async () => response({ error: 'blocked' }, 429))

    await expect(translateGoogle('hello', 'en', 'fr', {}, { request })).rejects.toThrow(
      'Google request failed with HTTP 429: blocked',
    )
  })

  it('wraps request failures with an actionable provider message', async () => {
    const request: GoogleRequest = vi.fn(async () => {
      throw new Error('connection reset')
    })

    await expect(translateGoogle('hello', 'en', 'fr', {}, { request })).rejects.toThrow(
      'Google request failed: connection reset',
    )
  })
})
