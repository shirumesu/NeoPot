import { net } from 'electron'
import type { HttpRequest, HttpRequestBody, HttpResponse } from '../../shared/types/electron-api'
import { getDeepLXCustomUrl, normalizeDeepLServiceType } from '../../shared/deeplConfig'
import { isLocalOrPrivateHost } from '../../shared/networkAddress'
import {
  DEFAULT_GOOGLE_TRANSLATE_URL,
  DEFAULT_LINGVA_URL,
  normalizeDeepLXEndpointUrl,
  normalizeGoogleTranslateBaseUrl,
  normalizeLingvaBaseUrl,
  normalizeOllamaBaseUrl,
} from '../../shared/providerUrl'
import {
  getServiceName,
  getServiceSouceType,
  ServiceSourceType,
} from '../../shared/serviceInstance'
import { getConfig } from './config'
import { assertPublicHttpRequestUrl, assertPublicHttpUrl } from './networkSafety'

export interface ProviderRequest {
  url?: string
  baseURL?: string
  method?: string
  headers?: HeadersInit
  params?: Record<string, unknown>
  data?: BodyInit | null
  timeoutMs?: number
}

export interface StreamResponseHandlers {
  onResponse(response: HttpResponse & { streaming: boolean }): void
  onChunk(chunk: Uint8Array): void
}

const allowedRendererMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
const forbiddenRendererHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'proxy-authorization',
  'te',
  'transfer-encoding',
  'upgrade',
])
const defaultServiceInstanceLists: Record<string, string[]> = {
  translate_service_list: ['deepl', 'google'],
  recognize_service_list: ['local_model'],
  tts_service_list: ['lingva'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addOrigin(origins: Set<string>, value: string): void {
  if (!value) {
    return
  }

  try {
    origins.add(new URL(value).origin)
  } catch {
    // Invalid provider URLs are rejected when the provider builds the request.
  }
}

function addConfiguredOrigin(origins: Set<string>, supplier: () => string): void {
  try {
    addOrigin(origins, supplier())
  } catch {
    // Invalid provider URLs are rejected when that provider builds the request.
  }
}

function readServiceInstanceList(serviceListKey: string): string[] {
  const serviceList = getConfig(serviceListKey)
  const configuredList = Array.isArray(serviceList)
    ? serviceList
    : (defaultServiceInstanceLists[serviceListKey] ?? [])

  return [...new Set(configuredList.filter((value): value is string => typeof value === 'string'))]
}

function configuredProviderOrigins(): Set<string> {
  const origins = new Set<string>()
  for (const serviceListKey of Object.keys(defaultServiceInstanceLists)) {
    const serviceList = readServiceInstanceList(serviceListKey)

    for (const serviceInstanceKey of serviceList) {
      if (getServiceSouceType(serviceInstanceKey) !== ServiceSourceType.BUILDIN) {
        continue
      }

      const serviceName = getServiceName(serviceInstanceKey)
      const config = getConfig(serviceInstanceKey)
      const providerConfig = isRecord(config) ? config : {}

      if (serviceName === 'ollama') {
        addConfiguredOrigin(origins, () => normalizeOllamaBaseUrl(providerConfig.requestPath))
      } else if (
        serviceName === 'deepl' &&
        normalizeDeepLServiceType(providerConfig.type) === 'deeplx'
      ) {
        addConfiguredOrigin(origins, () =>
          normalizeDeepLXEndpointUrl(getDeepLXCustomUrl(providerConfig)),
        )
      } else if (serviceName === 'lingva') {
        addConfiguredOrigin(origins, () => normalizeLingvaBaseUrl(providerConfig.custom_url))
      } else if (serviceName === 'google') {
        addConfiguredOrigin(origins, () =>
          normalizeGoogleTranslateBaseUrl(providerConfig.custom_url),
        )
      }
    }
  }

  addOrigin(origins, DEFAULT_LINGVA_URL)
  addOrigin(origins, DEFAULT_GOOGLE_TRANSLATE_URL)
  return origins
}

function isConfiguredPrivateProviderTarget(url: URL): boolean {
  return (
    isLocalOrPrivateHost(url.hostname.toLowerCase()) && configuredProviderOrigins().has(url.origin)
  )
}

function resolveProviderRequestUrl(options: ProviderRequest): string {
  if (typeof options.url === 'string') {
    try {
      return new URL(options.url, options.baseURL).toString()
    } catch {
      throw new Error('Expected a valid HTTP request URL.')
    }
  }

  if (typeof options.baseURL === 'string') {
    return options.baseURL
  }

  throw new Error('Expected a valid HTTP request URL.')
}

async function assertAllowedProviderRequestUrl(input: string): Promise<URL> {
  const uncheckedUrl = assertPublicHttpUrl(input, { allowPrivateNetwork: true })
  return assertPublicHttpRequestUrl(input, {
    allowPrivateNetwork: isConfiguredPrivateProviderTarget(uncheckedUrl),
  })
}

function normalizeRendererHeaders(headers: unknown): Record<string, string> {
  if (!isRecord(headers)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && !forbiddenRendererHeaders.has(entry[0].toLowerCase()),
      )
      .map(([key, value]) => [key.toLowerCase(), value]),
  )
}

function appendQuery(url: URL, query: unknown): void {
  if (!isRecord(query)) {
    return
  }

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item))
        }
      }
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }
}

function isHttpRequestBody(value: unknown): value is HttpRequestBody {
  return (
    isRecord(value) &&
    (value.kind === 'json' || value.kind === 'text' || value.kind === 'form') &&
    'data' in value
  )
}

function normalizeRendererBody(
  body: unknown,
  headers: Record<string, string>,
): BodyInit | null | undefined {
  if (body === undefined || body === null || typeof body === 'string') {
    return body
  }

  if (!isHttpRequestBody(body)) {
    throw new Error('Expected a serializable renderer HTTP request body.')
  }

  if (body.kind === 'json') {
    headers['content-type'] ??= 'application/json'
    return JSON.stringify(body.data)
  }

  if (body.kind === 'text') {
    return String(body.data)
  }

  if (headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams()
    Object.entries(body.data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value))
      }
    })
    return params
  }

  const params = new FormData()
  Object.entries(body.data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return params
}

function normalizeRendererRequest(input: unknown): {
  request: HttpRequest
  url: URL
  init: RequestInit
} {
  if (!isRecord(input) || typeof input.url !== 'string') {
    throw new Error('Expected renderer HTTP request URL.')
  }

  const method = typeof input.method === 'string' ? input.method.toUpperCase() : 'GET'
  if (!allowedRendererMethods.has(method)) {
    throw new Error(`HTTP request method is not allowed: ${method}`)
  }

  const headers = normalizeRendererHeaders(input.headers)
  const url = new URL(input.url)
  appendQuery(url, input.query)

  return {
    request: input as unknown as HttpRequest,
    url,
    init: {
      method,
      headers,
      body: normalizeRendererBody(input.body, headers),
      redirect: 'manual',
    },
  }
}

function normalizedTimeout(value: unknown, fallback?: number): number | undefined {
  if (value === undefined) {
    return fallback
  }

  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(value, 10 * 60_000)
    : fallback
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  if (timeoutMs === undefined) {
    return net.fetch(url, init)
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('HTTP request timed out.')),
    timeoutMs,
  )
  const abortFromCaller = () => controller.abort(init.signal?.reason)
  init.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    return await net.fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abortFromCaller)
  }
}

function responseHeaders(response: Response): Record<string, string> {
  return Object.fromEntries(response.headers.entries())
}

async function decodeResponseData(
  response: Response,
  responseType: HttpRequest['responseType'],
): Promise<unknown> {
  if (responseType === 'arrayBuffer') {
    return new Uint8Array(await response.arrayBuffer())
  }

  const text = await response.text()
  if (responseType === 'text') {
    return text
  }

  if (text === '') {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function responseMetadata(response: Response, data: unknown): HttpResponse {
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response),
    data,
  }
}

export async function request<T = unknown>(options: ProviderRequest): Promise<T> {
  const url = await assertAllowedProviderRequestUrl(resolveProviderRequestUrl(options))
  appendQuery(url, options.params)
  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.data,
      redirect: 'manual',
    },
    normalizedTimeout(options.timeoutMs, 30_000),
  )

  if (!response.ok) {
    throw new Error(`SERVICE_HTTP_ERROR:${response.status}`)
  }

  return (await decodeResponseData(response, 'json')) as T
}

export async function rendererHttpRequest(input: unknown): Promise<HttpResponse> {
  const { request: rendererRequest, url, init } = normalizeRendererRequest(input)
  const allowedUrl = await assertAllowedProviderRequestUrl(url.toString())
  const response = await fetchWithTimeout(
    allowedUrl.toString(),
    init,
    normalizedTimeout(rendererRequest.timeoutMs, 30_000),
  )
  const data = await decodeResponseData(response, rendererRequest.responseType)
  return responseMetadata(response, data)
}

export async function streamRendererHttpRequest(
  input: unknown,
  handlers: StreamResponseHandlers,
  signal: AbortSignal,
): Promise<void> {
  const { request: rendererRequest, url, init } = normalizeRendererRequest(input)
  const allowedUrl = await assertAllowedProviderRequestUrl(url.toString())
  const response = await fetchWithTimeout(
    allowedUrl.toString(),
    { ...init, signal },
    normalizedTimeout(rendererRequest.timeoutMs),
  )

  if (!response.ok) {
    const data = await decodeResponseData(response, rendererRequest.responseType)
    handlers.onResponse({ ...responseMetadata(response, data), streaming: false })
    return
  }

  handlers.onResponse({ ...responseMetadata(response, undefined), streaming: true })
  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      handlers.onChunk(value)
    }
  } finally {
    reader.releaseLock()
  }
}

export async function streamRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<ReadableStream<Uint8Array> | null> {
  const rawUrl =
    input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url
  const url = await assertAllowedProviderRequestUrl(rawUrl)
  const response = await net.fetch(url.toString(), { ...init, redirect: 'manual' })
  if (!response.ok) {
    throw new Error(`SERVICE_HTTP_ERROR:${response.status}`)
  }
  return response.body
}

export function createProviderClient(baseURL?: string) {
  return {
    request: <T = unknown>(options: ProviderRequest) =>
      request<T>({
        baseURL,
        ...options,
      }),
    streamRequest,
  }
}
