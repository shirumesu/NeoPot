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

const MAX_LOCAL_REQUEST_BODY_BYTES = 1024 * 1024

class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Local server request body is too large.')
  }
}

function readContentLength(request: IncomingMessage): number | null {
  const rawLength = request.headers['content-length']
  const contentLength = Array.isArray(rawLength) ? rawLength[0] : rawLength
  if (!contentLength) {
    return null
  }

  const parsedLength = Number(contentLength)
  return Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : null
}

async function readBody(
  request: IncomingMessage,
  maxBytes = MAX_LOCAL_REQUEST_BODY_BYTES,
): Promise<string> {
  const contentLength = readContentLength(request)
  if (contentLength !== null && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError()
  }

  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError()
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8')
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
      if (error instanceof RequestBodyTooLargeError) {
        logger.warn('Local server rejected oversized request body.', {
          path: request.url ?? '/',
          maxBytes: MAX_LOCAL_REQUEST_BODY_BYTES,
        })
        response.statusCode = 413
        response.end('request body too large', () => {
          if (!request.complete) {
            request.destroy()
          }
        })
        return
      }

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
