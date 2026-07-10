import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AppLogger } from '../../shared/logger'

export const DEFAULT_LOCAL_SERVER_PORT = 60828
export const DEFAULT_MAX_LOCAL_REQUEST_BODY_BYTES = 1024 * 1024

type LocalServerAction = () => Promise<unknown> | unknown

export interface LocalServerActions {
  textTranslate(text: string): Promise<unknown> | unknown
  openConfig: LocalServerAction
  selectionTranslate: LocalServerAction
  inputTranslate: LocalServerAction
  ocrRecognize: LocalServerAction
  recognizeWindow: LocalServerAction
  ocrTranslate: LocalServerAction
  imageTranslate: LocalServerAction
}

export type LocalServerLogger = Pick<AppLogger, 'warn'>

export interface LocalServerController {
  start(port?: number): Server
  stop(): void
}

interface CreateLocalServerOptions {
  actions: LocalServerActions
  logger: LocalServerLogger
  maxRequestBodyBytes?: number
}

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

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
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

async function handleRoute(
  request: IncomingMessage,
  response: ServerResponse,
  actions: LocalServerActions,
  maxRequestBodyBytes: number,
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')

  switch (requestUrl.pathname) {
    case '/':
    case '/translate':
      await actions.textTranslate(await readBody(request, maxRequestBodyBytes))
      break
    case '/config':
      await actions.openConfig()
      break
    case '/selection_translate':
      await actions.selectionTranslate()
      break
    case '/input_translate':
      await actions.inputTranslate()
      break
    case '/ocr_recognize':
      if (requestUrl.searchParams.get('screenshot') === 'false') {
        await actions.recognizeWindow()
      } else {
        await actions.ocrRecognize()
      }
      break
    case '/ocr_translate':
      if (requestUrl.searchParams.get('screenshot') === 'false') {
        await actions.imageTranslate()
      } else {
        await actions.ocrTranslate()
      }
      break
    default:
      response.statusCode = 404
      response.end('not found')
      return
  }

  ok(response)
}

export function createLocalServer({
  actions,
  logger,
  maxRequestBodyBytes = DEFAULT_MAX_LOCAL_REQUEST_BODY_BYTES,
}: CreateLocalServerOptions): LocalServerController {
  let server: Server | null = null

  return {
    start(port = DEFAULT_LOCAL_SERVER_PORT) {
      if (server) {
        return server
      }

      const nextServer = http.createServer((request, response) => {
        handleRoute(request, response, actions, maxRequestBodyBytes).catch((error) => {
          if (error instanceof RequestBodyTooLargeError) {
            logger.warn('Local server rejected oversized request body.', {
              path: request.url ?? '/',
              maxBytes: maxRequestBodyBytes,
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

      server = nextServer
      nextServer.on('error', (error) => {
        logger.warn('Local server start failed.', {
          port,
          error: error.message,
        })
        if (server === nextServer) {
          server = null
        }
      })
      nextServer.listen(port, '127.0.0.1')
      return nextServer
    },
    stop() {
      server?.close()
      server = null
    },
  }
}
