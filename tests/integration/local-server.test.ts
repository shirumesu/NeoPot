import { once } from 'node:events'
import http, { type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  createLocalServer,
  type LocalServerActions,
  type LocalServerController,
} from '../../src/main/modules/localServer'

type ActionCall = [name: keyof LocalServerActions, payload?: string]

const controllers: LocalServerController[] = []

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.stop()
  }
})

function createActions(calls: ActionCall[]): LocalServerActions {
  return {
    textTranslate: async (text) => {
      calls.push(['textTranslate', text])
    },
    openConfig: async () => {
      calls.push(['openConfig'])
    },
    selectionTranslate: async () => {
      calls.push(['selectionTranslate'])
    },
    inputTranslate: async () => {
      calls.push(['inputTranslate'])
    },
    ocrRecognize: async () => {
      calls.push(['ocrRecognize'])
    },
    recognizeWindow: async () => {
      calls.push(['recognizeWindow'])
    },
    ocrTranslate: async () => {
      calls.push(['ocrTranslate'])
    },
    imageTranslate: async () => {
      calls.push(['imageTranslate'])
    },
  }
}

async function startController(
  actions: LocalServerActions,
  maxRequestBodyBytes?: number,
): Promise<{ controller: LocalServerController; server: Server; origin: string }> {
  const controller = createLocalServer({
    actions,
    logger: { warn: vi.fn() },
    maxRequestBodyBytes,
  })
  controllers.push(controller)

  const server = controller.start(0)
  await once(server, 'listening')
  const address = server.address() as AddressInfo

  return {
    controller,
    server,
    origin: `http://127.0.0.1:${address.port}`,
  }
}

async function getResponse(origin: string, path: string, body?: string) {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    body,
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

async function rawRequest(
  origin: string,
  path: string,
  options: { headers?: Record<string, string>; chunks: string[] },
) {
  const target = new URL(path, origin)

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = http.request(
      target,
      {
        method: 'POST',
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )

    request.on('error', reject)
    for (const chunk of options.chunks) {
      request.write(chunk)
    }
    request.end()
  })
}

describe('local HTTP server', () => {
  test('routes requests to the matching workflow and preserves translation text', async () => {
    const calls: ActionCall[] = []
    const { origin } = await startController(createActions(calls))

    const responses = await Promise.all([
      getResponse(origin, '/', '第一段\nsecond line'),
      getResponse(origin, '/translate', 'another translation'),
      getResponse(origin, '/config'),
      getResponse(origin, '/selection_translate'),
      getResponse(origin, '/input_translate'),
      getResponse(origin, '/ocr_recognize'),
      getResponse(origin, '/ocr_recognize?screenshot=false'),
      getResponse(origin, '/ocr_translate'),
      getResponse(origin, '/ocr_translate?screenshot=false'),
    ])

    expect(responses).toEqual(
      Array.from({ length: 9 }, () => ({
        status: 200,
        body: 'ok',
      })),
    )
    expect(calls).toEqual(
      expect.arrayContaining<ActionCall>([
        ['textTranslate', '第一段\nsecond line'],
        ['textTranslate', 'another translation'],
        ['openConfig'],
        ['selectionTranslate'],
        ['inputTranslate'],
        ['ocrRecognize'],
        ['recognizeWindow'],
        ['ocrTranslate'],
        ['imageTranslate'],
      ]),
    )
    expect(calls).toHaveLength(9)
  })

  test('returns 404 without triggering a workflow for an unknown route', async () => {
    const calls: ActionCall[] = []
    const { origin } = await startController(createActions(calls))

    await expect(getResponse(origin, '/not-a-command')).resolves.toEqual({
      status: 404,
      body: 'not found',
    })
    expect(calls).toEqual([])
  })

  test('rejects a declared oversized body before invoking translation', async () => {
    const calls: ActionCall[] = []
    const { origin } = await startController(createActions(calls), 4)

    await expect(
      rawRequest(origin, '/translate', {
        headers: { 'content-length': '5' },
        chunks: ['abcde'],
      }),
    ).resolves.toEqual({
      status: 413,
      body: 'request body too large',
    })
    expect(calls).toEqual([])
  })

  test('rejects a streamed body that crosses the size limit', async () => {
    const calls: ActionCall[] = []
    const { origin } = await startController(createActions(calls), 4)

    await expect(
      rawRequest(origin, '/', {
        chunks: ['ab', 'cde'],
      }),
    ).resolves.toEqual({
      status: 413,
      body: 'request body too large',
    })
    expect(calls).toEqual([])
  })

  test('returns 500 when a workflow rejects and remains available afterward', async () => {
    const calls: ActionCall[] = []
    const actions = createActions(calls)
    actions.openConfig = async () => {
      calls.push(['openConfig'])
      throw new Error('window failed')
    }
    const { origin } = await startController(actions)

    await expect(getResponse(origin, '/config')).resolves.toEqual({
      status: 500,
      body: 'error',
    })
    await expect(getResponse(origin, '/input_translate')).resolves.toEqual({
      status: 200,
      body: 'ok',
    })
    expect(calls).toEqual([['openConfig'], ['inputTranslate']])
  })

  test('reuses one listener until stopped and can start again after the port is released', async () => {
    const calls: ActionCall[] = []
    const { controller, server, origin } = await startController(createActions(calls))

    expect(controller.start(0)).toBe(server)
    await expect(getResponse(origin, '/config')).resolves.toEqual({ status: 200, body: 'ok' })

    const closed = once(server, 'close')
    controller.stop()
    await closed
    await expect(fetch(`${origin}/config`)).rejects.toThrow()

    const restarted = controller.start(0)
    expect(restarted).not.toBe(server)
    await once(restarted, 'listening')
    const restartedPort = (restarted.address() as AddressInfo).port
    await expect(getResponse(`http://127.0.0.1:${restartedPort}`, '/config')).resolves.toEqual({
      status: 200,
      body: 'ok',
    })
    expect(calls).toEqual([['openConfig'], ['openConfig']])
  })
})
