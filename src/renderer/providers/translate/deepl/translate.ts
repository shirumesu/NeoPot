import { createDeepLXAuthHeaders, normalizeDeepLConfig } from '@/shared/deeplConfig'
import { normalizeDeepLXEndpointUrl } from '@/shared/providerUrl'

import { normalizeRequiredString } from './normalize'

export interface DeepLTranslateOptions {
  config?: unknown
}

export interface DeepLRequestBody {
  kind: 'json' | 'text'
  data: unknown
}

export interface DeepLRequestInit {
  method: 'POST'
  body: DeepLRequestBody
  headers: Record<string, string>
}

export interface DeepLResponse {
  ok: boolean
  status: number
  data: unknown
}

export type DeepLRequest = (url: string, init: DeepLRequestInit) => Promise<DeepLResponse>

export interface DeepLDependencies {
  request: DeepLRequest
}

const FREE_ENDPOINT = 'https://www2.deepl.com/jsonrpc'
const API_ENDPOINT = 'https://api.deepl.com/v2/translate'
const FREE_API_ENDPOINT = 'https://api-free.deepl.com/v2/translate'
const PRO_API_ENDPOINT = 'https://api.deepl-pro.com/v2/translate'
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const INVALID_RESPONSE_MESSAGE = 'DeepL returned an empty or malformed translation response.'

export async function translateDeepL(
  text: string,
  from: string,
  to: string,
  options: DeepLTranslateOptions = {},
  dependencies: DeepLDependencies,
): Promise<string> {
  const config = normalizeDeepLConfig(options.config)

  switch (config.type) {
    case 'api':
      return translateWithApi(
        text,
        from,
        to,
        normalizeRequiredString(config.authApi.authKey, 'DeepL Auth Key'),
        dependencies.request,
      )
    case 'deeplx':
      return translateWithDeepLX(
        text,
        from,
        to,
        normalizeRequiredString(normalizeDeepLXEndpointUrl(config.deeplx.customUrl), 'DeepLX URL'),
        config.deeplx.authKey,
        dependencies.request,
      )
    case 'free':
    default:
      return translateWithFreeEndpoint(text, from, to, dependencies.request)
  }
}

async function translateWithFreeEndpoint(
  text: string,
  from: string,
  to: string,
  request: DeepLRequest,
): Promise<string> {
  const id = getRandomRequestId()
  const body = {
    jsonrpc: '2.0',
    method: 'LMT_handle_texts',
    params: {
      splitting: 'newlines',
      lang: {
        source_lang_user_selected: normalizeDeepLSourceLanguage(from),
        target_lang: normalizeDeepLTargetLanguage(to),
      },
      texts: [{ text, requestAlternatives: 3 }],
      timestamp: getTimestamp(getICount(text)),
    },
    id,
  }

  let serializedBody = JSON.stringify(body)
  serializedBody =
    (id + 5) % 29 === 0 || (id + 3) % 13 === 0
      ? serializedBody.replace('"method":"', '"method" : "')
      : serializedBody.replace('"method":"', '"method": "')

  const response = await performRequest(request, FREE_ENDPOINT, {
    method: 'POST',
    body: { kind: 'text', data: serializedBody },
    headers: JSON_HEADERS,
  })
  const result = asRecord(response.data)
  const texts = asRecord(result?.result)?.texts
  const firstText = Array.isArray(texts) ? asRecord(texts[0])?.text : undefined
  return requireTranslation(firstText)
}

async function translateWithApi(
  text: string,
  from: string,
  to: string,
  authKey: string,
  request: DeepLRequest,
): Promise<string> {
  const body: Record<string, unknown> = {
    text: [text],
    target_lang: normalizeDeepLTargetLanguage(to),
  }
  if (from !== 'auto') {
    body.source_lang = normalizeDeepLSourceLanguage(from)
  }

  const response = await performRequest(request, apiEndpointForKey(authKey), {
    method: 'POST',
    body: { kind: 'json', data: body },
    headers: {
      ...JSON_HEADERS,
      Authorization: `DeepL-Auth-Key ${authKey}`,
    },
  })
  const translations = asRecord(response.data)?.translations
  const firstText = Array.isArray(translations) ? asRecord(translations[0])?.text : undefined
  return requireTranslation(firstText)
}

async function translateWithDeepLX(
  text: string,
  from: string,
  to: string,
  url: string,
  authKey: string,
  request: DeepLRequest,
): Promise<string> {
  const response = await performRequest(request, url, {
    method: 'POST',
    body: {
      kind: 'json',
      data: {
        source_lang: normalizeDeepLSourceLanguage(from),
        target_lang: normalizeDeepLTargetLanguage(to),
        text,
      },
    },
    headers: {
      ...JSON_HEADERS,
      ...createDeepLXAuthHeaders(authKey),
    },
  })
  return requireTranslation(asRecord(response.data)?.data)
}

async function performRequest(
  request: DeepLRequest,
  url: string,
  init: DeepLRequestInit,
): Promise<DeepLResponse> {
  let response: DeepLResponse
  try {
    response = await request(url, init)
  } catch (error) {
    throw new Error(`DeepL request failed: ${errorMessage(error)}`, { cause: error })
  }

  if (!response.ok) {
    throw new Error(
      `DeepL request failed with HTTP ${response.status}: ${responseMessage(response.data)}`,
    )
  }

  return response
}

function requireTranslation(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }

  return value.trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function responseMessage(data: unknown): string {
  const record = asRecord(data)
  const nestedError = asRecord(record?.error)
  const message = nestedError?.message ?? record?.message
  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }
  if (typeof data === 'string' && data.trim()) {
    return data.trim()
  }
  return 'Unexpected response.'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }
  return 'Unknown request error.'
}

function apiEndpointForKey(authKey: string): string {
  if (authKey.endsWith(':fx')) {
    return FREE_API_ENDPOINT
  }
  if (authKey.endsWith(':dp')) {
    return PRO_API_ENDPOINT
  }
  return API_ENDPOINT
}

function getTimestamp(iCount: number): number {
  const timestamp = Date.now()
  return iCount === 0 ? timestamp : timestamp - (timestamp % (iCount + 1)) + iCount + 1
}

function getICount(text: string): number {
  return text.split('i').length - 1
}

function getRandomRequestId(): number {
  return (Math.floor(Math.random() * 99999) + 100000) * 1000
}

function normalizeDeepLSourceLanguage(language: string): string {
  return language === 'auto' ? 'auto' : language.split('-')[0]
}

function normalizeDeepLTargetLanguage(language: string): string {
  return language
}
