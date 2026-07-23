import type {
  HttpRequest,
  HttpRequestBody,
  HttpResponse,
  HttpStreamEvent,
} from '@/shared/types/electron-api'

type FormFileValue = {
  file: BlobPart
  mime?: string
  fileName?: string
}

type ElectronBody =
  | { kind: 'json'; data: unknown }
  | { kind: 'text'; data: unknown }
  | { kind: 'form'; data: Record<string, unknown> }

export interface ElectronFetchInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit | ElectronBody | HttpRequestBody | null
  query?: Record<string, unknown>
  responseType?: 2 | 3
  skipData?: boolean
  timeoutMs?: number
}

export interface ElectronHttpResponse<T = unknown> {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  data: T
  body?: ReadableStream<Uint8Array>
  text(): Promise<string>
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
  clone(): ElectronHttpResponse<T>
}

export const Body = {
  json(data: unknown): ElectronBody {
    return { kind: 'json', data }
  },
  text(data: unknown): ElectronBody {
    return { kind: 'text', data }
  },
  form(data: Record<string, unknown>): ElectronBody {
    return { kind: 'form', data }
  },
}

function isFormFileValue(value: unknown): value is FormFileValue {
  return typeof value === 'object' && value !== null && 'file' in value
}

function isSerializedBody(value: unknown): value is HttpRequestBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'data' in value &&
    (value.kind === 'json' || value.kind === 'text' || value.kind === 'form')
  )
}

function normalizeBody(
  body: ElectronFetchInit['body'],
): HttpRequestBody | string | null | undefined {
  if (body === undefined || body === null || typeof body === 'string') {
    return body
  }

  if (isSerializedBody(body)) {
    if (body.kind === 'text') {
      return { kind: 'text', data: String(body.data) }
    }
    if (body.kind === 'form') {
      return {
        kind: 'form',
        data: Object.fromEntries(
          Object.entries(body.data).map(([key, value]) => [
            key,
            isFormFileValue(value) ? String(value.file) : value,
          ]),
        ),
      }
    }
    return { kind: 'json', data: body.data }
  }

  if (body instanceof URLSearchParams) {
    return { kind: 'text', data: body.toString() }
  }

  throw new Error('Electron HTTP requests require Body.json, Body.text, or Body.form.')
}

function responseTypeName(responseType?: 2 | 3): HttpRequest['responseType'] {
  if (responseType === 3) {
    return 'arrayBuffer'
  }
  if (responseType === 2) {
    return 'text'
  }
  return 'json'
}

function createBufferedResponse<T>(
  result: HttpResponse,
  responseType?: 2 | 3,
): ElectronHttpResponse<T> {
  const headers = new Headers(result.headers)
  const data =
    responseType === 3 && result.data instanceof Uint8Array
      ? result.data.buffer.slice(
          result.data.byteOffset,
          result.data.byteOffset + result.data.byteLength,
        )
      : result.data

  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    headers,
    data: data as T,
    async text() {
      return typeof data === 'string' ? data : (JSON.stringify(data) ?? '')
    },
    async json() {
      return typeof data === 'string' ? JSON.parse(data) : data
    },
    async arrayBuffer() {
      return data instanceof ArrayBuffer ? data : new TextEncoder().encode(String(data)).buffer
    },
    clone() {
      return createBufferedResponse<T>(result, responseType)
    },
  }
}

function createStreamingResponse<T>(
  request: HttpRequest,
  responseType: 2 | 3 | undefined,
  signal: AbortSignal | null | undefined,
): Promise<ElectronHttpResponse<T>> {
  return new Promise((resolve, reject) => {
    let settled = false
    let finished = false
    let cancelBridge: () => void = () => undefined
    let streamController: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
      cancel() {
        cancelBridge()
      },
    })

    const finish = () => {
      if (finished) {
        return
      }
      finished = true
      signal?.removeEventListener('abort', abort)
      cancelBridge()
    }

    const abort = () => {
      const error = new DOMException('The operation was aborted.', 'AbortError')
      if (settled) {
        streamController.error(error)
      } else {
        reject(error)
      }
      finish()
    }

    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })

    cancelBridge = window.neoPot.http.stream(request, (event: HttpStreamEvent) => {
      if (finished) {
        return
      }

      if (event.type === 'response') {
        settled = true
        if (!event.streaming) {
          resolve(
            createBufferedResponse<T>(
              {
                ok: event.ok,
                status: event.status,
                statusText: event.statusText,
                headers: event.headers,
                data: event.data,
              },
              responseType,
            ),
          )
          return
        }

        const response = new Response(body, {
          status: event.status,
          statusText: event.statusText,
          headers: event.headers,
        })
        Object.defineProperty(response, 'data', {
          value: undefined,
          enumerable: true,
        })
        resolve(response as unknown as ElectronHttpResponse<T>)
        return
      }

      if (event.type === 'chunk') {
        streamController.enqueue(event.data)
        return
      }

      if (event.type === 'end') {
        streamController.close()
        if (!settled) {
          reject(new Error('HTTP stream ended before response metadata was received.'))
        }
        finish()
        return
      }

      const error = new Error(event.message)
      if (settled) {
        streamController.error(error)
      } else {
        reject(error)
      }
      finish()
    })
  })
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(headers).entries())
}

export async function fetch<T = unknown>(
  input: string | URL,
  init: ElectronFetchInit = {},
): Promise<ElectronHttpResponse<T>> {
  const { responseType, query, skipData, timeoutMs, signal, ...requestInit } = init
  const request: HttpRequest = {
    url: new URL(input).href,
    method: requestInit.method,
    headers: headersToObject(requestInit.headers),
    body: normalizeBody(requestInit.body),
    query,
    responseType: responseTypeName(responseType),
    timeoutMs,
  }

  if (skipData) {
    return createStreamingResponse<T>(request, responseType, signal)
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const result = await window.neoPot.http.request(request)
  return createBufferedResponse<T>(result, responseType)
}
