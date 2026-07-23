import { isLocalOrPrivateHost, isPrivateIpv6 } from './networkAddress'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_LINGVA_URL = 'https://lingva.ml'
export const DEFAULT_GOOGLE_TRANSLATE_URL = 'https://translate.google.com'

type DefaultScheme = 'http' | 'https' | 'local-http'

interface ProviderUrlOptions {
  defaultUrl?: string
  defaultScheme?: DefaultScheme
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasExplicitHttpScheme(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function hasUnsupportedAbsoluteScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !hasExplicitHttpScheme(value)
}

function readSchemeLessAuthority(value: string): string {
  const slashIndex = value.search(/[/?#]/u)
  return slashIndex === -1 ? value : value.slice(0, slashIndex)
}

function readSchemeLessHost(value: string): string {
  const authority = readSchemeLessAuthority(value)
  if (authority.startsWith('[')) {
    const endBracketIndex = authority.indexOf(']')
    return endBracketIndex === -1 ? authority : authority.slice(1, endBracketIndex)
  }

  const colonCount = [...authority].filter((character) => character === ':').length
  return colonCount === 1 ? authority.split(':', 1)[0] : authority
}

function normalizeSchemeLessInput(value: string): string {
  const authority = readSchemeLessAuthority(value)
  if (authority.includes(':') && !authority.startsWith('[') && isPrivateIpv6(authority)) {
    return `[${authority}]${value.slice(authority.length)}`
  }

  return value
}

function inferScheme(value: string, defaultScheme: DefaultScheme): 'http' | 'https' {
  if (defaultScheme === 'local-http') {
    return isLocalOrPrivateHost(readSchemeLessHost(value)) ? 'http' : 'https'
  }

  return defaultScheme
}

export function normalizeProviderUrl(value: unknown, options: ProviderUrlOptions = {}): URL | null {
  const rawValue = readString(value) || options.defaultUrl
  if (!rawValue) {
    return null
  }

  const normalizedValue = readString(rawValue)
  if (hasUnsupportedAbsoluteScheme(normalizedValue)) {
    return null
  }

  const withScheme = hasExplicitHttpScheme(normalizedValue)
    ? normalizedValue
    : `${inferScheme(normalizedValue, options.defaultScheme ?? 'local-http')}://${normalizeSchemeLessInput(normalizedValue)}`

  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url
  } catch {
    return null
  }
}

export function normalizeProviderBaseUrl(value: unknown, options: ProviderUrlOptions = {}): string {
  const url = normalizeProviderUrl(value, options)
  if (!url) {
    if (readString(value)) {
      throw new Error('Expected a valid HTTP provider URL.')
    }

    return options.defaultUrl ?? ''
  }

  return url.toString().replace(/\/+$/u, '')
}

export function normalizeOllamaBaseUrl(value: unknown): string {
  return normalizeProviderBaseUrl(value, {
    defaultUrl: DEFAULT_OLLAMA_URL,
    defaultScheme: 'local-http',
  })
}

export function normalizeLingvaBaseUrl(value: unknown): string {
  return normalizeProviderBaseUrl(value, {
    defaultUrl: DEFAULT_LINGVA_URL,
    defaultScheme: 'local-http',
  })
}

export function normalizeGoogleTranslateBaseUrl(value: unknown): string {
  return normalizeProviderBaseUrl(value, {
    defaultUrl: DEFAULT_GOOGLE_TRANSLATE_URL,
    defaultScheme: 'local-http',
  })
}

export function normalizeDeepLXEndpointUrl(value: unknown): string {
  const url = normalizeProviderUrl(value, { defaultScheme: 'local-http' })
  if (!url) {
    if (readString(value)) {
      throw new Error('Expected a valid HTTP provider URL.')
    }

    return ''
  }

  return url.toString()
}
