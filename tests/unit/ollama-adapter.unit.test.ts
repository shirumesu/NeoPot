import { describe, expect, it, vi } from 'vitest'

import {
  translateOllama,
  type OllamaRequest,
  type OllamaRequestInit,
  type OllamaResponse,
} from '../../src/renderer/providers/translate/ollama/translate'

function nonStreamResponse(data: unknown, status = 200): OllamaResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    data,
    text: async () => JSON.stringify(data),
  }
}

function requestReturning(response: OllamaResponse): OllamaRequest {
  return vi.fn(async () => response)
}

function requestCall(request: OllamaRequest): [string, OllamaRequestInit] {
  return vi.mocked(request).mock.calls[0]
}

function streamResponse(chunks: string[]): OllamaResponse {
  const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk))
  let index = 0

  return {
    ok: true,
    status: 200,
    text: async () => chunks.join(''),
    body: {
      getReader: () => ({
        read: async () =>
          index < encoded.length
            ? { done: false as const, value: encoded[index++] }
            : { done: true as const, value: undefined },
      }),
    },
  }
}

describe('Ollama adapter', () => {
  it('builds the prompt, migrated model, numeric options, and Gemma thinking request', async () => {
    const request = requestReturning(nonStreamResponse({ message: { content: ' translated ' } }))

    await expect(
      translateOllama(
        'source text',
        'English',
        'Traditional Chinese',
        {
          detect: 'zh_cn',
          config: {
            model: 'gemma:2b',
            requestPath: 'localhost:11434/',
            stream: false,
            temperature: '0.25',
            topP: '0.9',
            topK: '40',
            thinkingMode: 'on',
            promptList: [
              { role: 'system', content: 'Translate carefully.' },
              { role: 'user', content: '$text | $from | $to | $detect' },
            ],
          },
        },
        { request },
      ),
    ).resolves.toBe('translated')

    const [url, init] = requestCall(request)
    expect(url).toBe('http://localhost:11434/api/chat')
    expect(init).toEqual({
      method: 'POST',
      headers: {},
      body: {
        kind: 'json',
        data: {
          model: 'gemma4:e2b',
          messages: [
            { role: 'system', content: '<|think|>\nTranslate carefully.' },
            {
              role: 'user',
              content: 'source text | English | Traditional Chinese | Simplified Chinese',
            },
          ],
          stream: false,
          options: { temperature: 0.25, top_p: 0.9, top_k: 40 },
        },
      },
      skipData: false,
    })
  })

  it('passes an explicit think value to non-Gemma models', async () => {
    const request = requestReturning(nonStreamResponse({ message: { content: 'ok' } }))

    await translateOllama(
      'text',
      'English',
      'French',
      {
        config: {
          model: 'qwen3',
          thinkingMode: 'off',
          promptList: [{ role: 'user', content: '$text' }],
        },
      },
      { request },
    )

    const [, init] = requestCall(request)
    expect(init.body.data).toMatchObject({ model: 'qwen3', think: false })
  })

  it('returns a non-stream response and publishes it when setResult is available', async () => {
    const setResult = vi.fn()

    await expect(
      translateOllama(
        'text',
        'English',
        'French',
        { config: { promptList: [], stream: false }, setResult },
        { request: requestReturning(nonStreamResponse({ message: { content: ' bonjour ' } })) },
      ),
    ).resolves.toBe('bonjour')
    expect(setResult).toHaveBeenCalledExactlyOnceWith('bonjour')
  })

  it('reports a non-stream HTTP error', async () => {
    await expect(
      translateOllama(
        'text',
        'English',
        'French',
        { config: { promptList: [], stream: false } },
        { request: requestReturning(nonStreamResponse({ error: 'model unavailable' }, 503)) },
      ),
    ).rejects.toThrow('Ollama chat failed with HTTP 503: model unavailable')
  })

  it.each([{}, { message: {} }, { message: { content: '   ' } }])(
    'rejects an empty or malformed non-stream response',
    async (data) => {
      await expect(
        translateOllama(
          'text',
          'English',
          'French',
          { config: { promptList: [], stream: false } },
          { request: requestReturning(nonStreamResponse(data)) },
        ),
      ).rejects.toThrow('Ollama returned an empty or malformed translation response.')
    },
  )

  it('parses NDJSON across chunks, skips bad lines, consumes a tail block, and throttles increments', async () => {
    const setResult = vi.fn()
    const response = streamResponse([
      '{"message":{"content":"Hel',
      'lo"}}\nnot-json\n{"message":{"content":" "}}\n{"message":{"content":"wor',
      'ld"}}',
    ])

    await expect(
      translateOllama(
        'text',
        'English',
        'French',
        { config: { promptList: [], stream: true }, setResult },
        { request: requestReturning(response) },
      ),
    ).resolves.toBe('Hello world')
    expect(setResult.mock.calls.map(([value]) => value)).toEqual(['Hello_', 'Hello world'])
  })

  it('consumes the complete text stream and returns the result when setResult is absent', async () => {
    const response: OllamaResponse = {
      ok: true,
      status: 200,
      text: async () =>
        '{"message":{"content":"complete "}}\ninvalid\n{"message":{"content":"result"}}',
    }

    await expect(
      translateOllama(
        'text',
        'English',
        'French',
        { config: { promptList: [], stream: true } },
        { request: requestReturning(response) },
      ),
    ).resolves.toBe('complete result')
  })

  it('cancels a pending throttled update when stream reading fails', async () => {
    vi.useFakeTimers()
    try {
      const setResult = vi.fn()
      const encoded = new TextEncoder().encode(
        '{"message":{"content":"first"}}\n{"message":{"content":" second"}}\n',
      )
      let readCount = 0
      const response: OllamaResponse = {
        ok: true,
        status: 200,
        text: async () => '',
        body: {
          getReader: () => ({
            read: async () => {
              readCount += 1
              if (readCount === 1) {
                return { done: false as const, value: encoded }
              }
              throw new Error('stream failed')
            },
          }),
        },
      }

      await expect(
        translateOllama(
          'text',
          'English',
          'French',
          { config: { promptList: [], stream: true }, setResult },
          { request: requestReturning(response) },
        ),
      ).rejects.toThrow('stream failed')

      await vi.advanceTimersByTimeAsync(100)
      expect(setResult.mock.calls.map(([value]) => value)).toEqual(['first_'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('wraps request failures with an actionable message', async () => {
    const request: OllamaRequest = vi.fn(async () => {
      throw new Error('connection refused')
    })

    await expect(
      translateOllama('text', 'English', 'French', { config: { promptList: [] } }, { request }),
    ).rejects.toThrow('Ollama request failed: connection refused')
  })
})
