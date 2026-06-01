import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { logger } from '../logger'
import {
  imageTranslate,
  inputTranslate,
  ocrRecognize,
  ocrTranslate,
  openConfig,
  recognizeWindow,
  selectionTranslate,
  textTranslate,
} from './workflow'

let server: Server | null = null

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function ok(response: ServerResponse): void {
  response.statusCode = 200
  response.end('ok')
}

async function handleRoute(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')

  switch (requestUrl.pathname) {
    case '/':
    case '/translate':
      await textTranslate(await readBody(request))
      break
    case '/config':
      await openConfig()
      break
    case '/selection_translate':
      await selectionTranslate()
      break
    case '/input_translate':
      await inputTranslate()
      break
    case '/ocr_recognize':
      if (requestUrl.searchParams.get('screenshot') === 'false') {
        await recognizeWindow()
      } else {
        await ocrRecognize()
      }
      break
    case '/ocr_translate':
      if (requestUrl.searchParams.get('screenshot') === 'false') {
        await imageTranslate()
      } else {
        await ocrTranslate()
      }
      break
    default:
      response.statusCode = 404
      response.end('not found')
      return
  }

  ok(response)
}

export function startServer(port = 60828): void {
  if (server) {
    return
  }

  server = http.createServer((request, response) => {
    handleRoute(request, response).catch((error) => {
      logger.warn('Local server route failed.', {
        path: request.url ?? '/',
        error: error instanceof Error ? error.message : String(error),
      })
      response.statusCode = 500
      response.end('error')
    })
  })

  server.on('error', (error) => {
    logger.warn('Local server start failed.', {
      port,
      error: error.message,
    })
    server = null
  })

  server.listen(port, '127.0.0.1')
}

export function stopServer(): void {
  server?.close()
  server = null
}
