import { describe, expect, it, vi } from 'vitest'

import {
  translateDeepL,
  type DeepLRequest,
  type DeepLRequestBody,
  type DeepLRequestInit,
} from '../../src/renderer/providers/translate/deepl/translate'

function successfulResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    data,
  }
}

function requestReturning(data: unknown): DeepLRequest {
  return vi.fn(async () => successfulResponse(data))
}

function requestCall(request: DeepLRequest): [string, DeepLRequestInit] {
  return vi.mocked(request).mock.calls[0]
}

function jsonBody(body: DeepLRequestBody): Record<string, unknown> {
  expect(body.kind).toBe('json')
  return body.data as Record<string, unknown>
}

describe('DeepL adapter', () => {
  it('builds the free JSON-RPC request and preserves the target Chinese variant', async () => {
    const request = requestReturning({ result: { texts: [{ text: ' 翻译结果 ' }] } })

    await expect(
      translateDeepL('hello', 'ZH-HANT', 'ZH-HANS', { config: { type: 'free' } }, { request }),
    ).resolves.toBe('翻译结果')

    const [url, init] = requestCall(request)
    expect(url).toBe('https://www2.deepl.com/jsonrpc')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body.kind).toBe('text')

    const payload = JSON.parse(String(init.body.data))
    expect(payload).toMatchObject({
      jsonrpc: '2.0',
      method: 'LMT_handle_texts',
      params: {
        lang: {
          source_lang_user_selected: 'ZH',
          target_lang: 'ZH-HANS',
        },
        texts: [{ text: 'hello', requestAlternatives: 3 }],
      },
    })
  })

  it.each([
    ['plain API key', 'secret', 'https://api.deepl.com/v2/translate'],
    ['free API key', 'secret:fx', 'https://api-free.deepl.com/v2/translate'],
    ['pro API key', 'secret:dp', 'https://api.deepl-pro.com/v2/translate'],
  ])('builds the API request for a %s', async (_label, authKey, expectedUrl) => {
    const request = requestReturning({ translations: [{ text: ' 结果 ' }] })

    await expect(
      translateDeepL(
        'hello',
        'auto',
        'ZH-HANT',
        { config: { type: 'api', authApi: { authKey } } },
        { request },
      ),
    ).resolves.toBe('结果')

    const [url, init] = requestCall(request)
    expect(url).toBe(expectedUrl)
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${authKey}`,
    })
    expect(jsonBody(init.body)).toEqual({
      text: ['hello'],
      target_lang: 'ZH-HANT',
    })
  })

  it('builds the DeepLX request with normalized source language and bearer auth', async () => {
    const request = requestReturning({ data: ' 成功 ' })

    await expect(
      translateDeepL(
        'hello',
        'ZH-HANS',
        'ZH-HANT',
        {
          config: {
            type: 'deeplx',
            deeplx: {
              customUrl: 'localhost:1188/translate',
              authKey: ' token ',
            },
          },
        },
        { request },
      ),
    ).resolves.toBe('成功')

    const [url, init] = requestCall(request)
    expect(url).toBe('http://localhost:1188/translate')
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    })
    expect(jsonBody(init.body)).toEqual({
      source_lang: 'ZH',
      target_lang: 'ZH-HANT',
      text: 'hello',
    })
  })

  it.each([
    ['free', { result: { texts: [] } }],
    ['api', { translations: [{ text: '   ' }] }],
    ['deeplx', { data: { unexpected: true } }],
  ])('rejects an empty or malformed %s success response', async (type, data) => {
    const config =
      type === 'api'
        ? { type, authApi: { authKey: 'secret' } }
        : type === 'deeplx'
          ? { type, deeplx: { customUrl: 'http://localhost:1188/translate', authKey: '' } }
          : { type }

    await expect(
      translateDeepL('hello', 'auto', 'EN', { config }, { request: requestReturning(data) }),
    ).rejects.toThrow('DeepL returned an empty or malformed translation response.')
  })

  it.each([
    [401, { error: { message: 'Invalid authentication key.' } }, 'Invalid authentication key.'],
    [429, { message: 'Too many requests.' }, 'Too many requests.'],
  ])('reports HTTP %s responses with the provider message', async (status, data, message) => {
    const request: DeepLRequest = vi.fn(async () => ({ ok: false, status, data }))

    await expect(
      translateDeepL(
        'hello',
        'auto',
        'EN',
        { config: { type: 'api', authApi: { authKey: 'secret' } } },
        { request },
      ),
    ).rejects.toThrow(`DeepL request failed with HTTP ${status}: ${message}`)
  })

  it('wraps request failures without exposing request configuration', async () => {
    const request: DeepLRequest = vi.fn(async () => {
      throw new Error('connection reset')
    })

    await expect(
      translateDeepL(
        'hello',
        'auto',
        'EN',
        { config: { type: 'api', authApi: { authKey: 'do-not-leak' } } },
        { request },
      ),
    ).rejects.toThrow('DeepL request failed: connection reset')
  })
})
