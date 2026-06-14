import axios, { type AxiosRequestConfig } from 'axios'
import { net } from 'electron'
import { applyProxyToAxios } from './proxy'
import {
  assertPublicHttpRequestUrl,
  assertPublicHttpUrl,
  isBlockedNetworkAddress,
} from './networkSafety'
import { getConfig } from './config'
import { getDeepLXCustomUrl, normalizeDeepLServiceType } from '../../shared/deeplConfig'
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

export interface ProviderRequest extends AxiosRequestConfig {
  timeoutMs?: number
}

type RendererBody =
  | { kind: 'json'; data: unknown }
  | { kind: 'text'; data: string }
  | { kind: 'form'; data: Record<string, unknown> }

interface RendererHttpRequest {
  url?: unknown
  method?: unknown
  headers?: unknown
  query?: unknown
  body?: unknown
  responseType?: unknown
}

const allowedRendererMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
const forbiddenRendererHeaders = new Set([
  'connection',
  'content-length',
  'host',
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
const localHostnames = new Set(['localhost', 'localhost.localdomain'])

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
    // Invalid provider URLs are rejected when that provider builds its request.
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
  const hostname = url.hostname.toLowerCase()
  return (
    (localHostnames.has(hostname) || isBlockedNetworkAddress(hostname)) &&
    configuredProviderOrigins().has(url.origin)
  )
}

function resolveAxiosRequestUrl(config: AxiosRequestConfig): string {
  if (typeof config.url === 'string') {
    try {
      return new URL(config.url, config.baseURL).toString()
    } catch {
      throw new Error('Expected a valid HTTP request URL.')
    }
  }

  if (typeof config.baseURL === 'string') {
    return config.baseURL
  }

  throw new Error('Expected a valid HTTP request URL.')
}

function resolveFetchRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.toString()
  }

  if (typeof input === 'string') {
    return input
  }

  if (input instanceof Request) {
    return input.url
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

function normalizeRendererBody(body: unknown, headers: Record<string, string>): unknown {
  if (!isRecord(body) || typeof body.kind !== 'string') {
    return body
  }

  const rendererBody = body as RendererBody
  if (rendererBody.kind === 'json') {
    headers['content-type'] ??= 'application/json'
    return rendererBody.data
  }

  if (rendererBody.kind === 'text') {
    return rendererBody.data
  }

  if (headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams()
    Object.entries(rendererBody.data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value))
      }
    })
    return params.toString()
  }

  const params = new FormData()
  Object.entries(rendererBody.data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return params
}

export async function request<T = unknown>(options: ProviderRequest): Promise<T> {
  const url = await assertAllowedProviderRequestUrl(resolveAxiosRequestUrl(options))
  const requestOptions: ProviderRequest = { ...options }
  delete requestOptions.baseURL
  delete requestOptions.maxRedirects
  delete requestOptions.timeoutMs
  delete requestOptions.url

  const response = await axios.request<T>(
    applyProxyToAxios({
      ...requestOptions,
      url: url.toString(),
      maxRedirects: 0,
      timeout: options.timeoutMs ?? options.timeout ?? 30000,
    }),
  )

  return response.data
}

export async function rendererHttpRequest(input: unknown): Promise<{
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
}> {
  if (!isRecord(input) || typeof input.url !== 'string') {
    throw new Error('Expected renderer HTTP request URL.')
  }

  const requestInput = input as RendererHttpRequest
  const uncheckedUrl = assertPublicHttpUrl(input.url, { allowPrivateNetwork: true })
  const url = await assertPublicHttpRequestUrl(input.url, {
    allowPrivateNetwork: isConfiguredPrivateProviderTarget(uncheckedUrl),
  })
  const method = typeof requestInput.method === 'string' ? requestInput.method.toUpperCase() : 'GET'
  if (!allowedRendererMethods.has(method)) {
    throw new Error(`HTTP request method is not allowed: ${method}`)
  }

  const headers = normalizeRendererHeaders(requestInput.headers)
  const responseType =
    requestInput.responseType === 3
      ? 'arraybuffer'
      : requestInput.responseType === 2
        ? 'text'
        : 'json'

  const response = await axios.request(
    applyProxyToAxios({
      url: url.toString(),
      method,
      headers,
      params: isRecord(requestInput.query) ? requestInput.query : undefined,
      data: normalizeRendererBody(requestInput.body, headers),
      responseType,
      maxRedirects: 0,
      timeout: 30000,
      validateStatus: () => true,
    }),
  )

  const data =
    requestInput.responseType === 3 && response.data instanceof Uint8Array
      ? Array.from(response.data)
      : requestInput.responseType === 3 && response.data instanceof ArrayBuffer
        ? Array.from(new Uint8Array(response.data))
        : response.data

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : String(value),
      ]),
    ),
    data,
  }
}

export async function streamRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<ReadableStream<Uint8Array> | null> {
  const url = await assertAllowedProviderRequestUrl(resolveFetchRequestUrl(input))
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
