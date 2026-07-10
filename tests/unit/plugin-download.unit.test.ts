import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { downloadRemotePluginFile } from '../../src/main/plugins/remoteDownload'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'neopot-plugin-download-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
    { status: 200 },
  )
}

describe('remote plugin downloads', () => {
  test('streams successful responses to disk without buffering the whole archive', async () => {
    const target = path.join(tempDir, 'plugin.zip')

    await downloadRemotePluginFile('https://plugins.example.test/plugin.zip', target, {
      maxBytes: 16,
      fetchImpl: async () => responseFromChunks(['abc', 'def']),
    })

    expect(await readFile(target, 'utf8')).toBe('abcdef')
  })

  test('rejects a chunked response that crosses the compressed-byte limit and cleans up', async () => {
    const target = path.join(tempDir, 'oversized.zip')

    await expect(
      downloadRemotePluginFile('https://plugins.example.test/oversized.zip', target, {
        maxBytes: 5,
        fetchImpl: async () => responseFromChunks(['1234', '5678']),
      }),
    ).rejects.toThrow(/exceeded.*5 bytes/i)
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('aborts a stalled request at the explicit timeout', async () => {
    const target = path.join(tempDir, 'timeout.zip')

    await expect(
      downloadRemotePluginFile('https://plugins.example.test/timeout.zip', target, {
        timeoutMs: 10,
        fetchImpl: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            })
          }),
      }),
    ).rejects.toThrow(/timed out after 10 ms/i)
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
