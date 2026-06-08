export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_LINGVA_URL = 'https://lingva.ml'
export const DEFAULT_GOOGLE_TRANSLATE_URL = 'https://translate.google.com'

type DefaultScheme = 'http' | 'https' | 'local-http'

interface ProviderUrlOptions {
  defaultUrl?: string
  defaultScheme?: DefaultScheme
}

const localHostnames = new Set(['localhost', 'localhost.localdomain'])

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasExplicitHttpScheme(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function hasUnsupportedAbsoluteScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !hasExplicitHttpScheme(value)
}

function normalizeIpInput(value: string): string {
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized
}

function parseIpv4(value: string): number[] | null {
  const normalized = normalizeIpInput(value)
  const parts = normalized.split('.')
  if (parts.length !== 4) {
    return null
  }

  const parsed = parts.map((part) => {
    if (!/^\d+$/u.test(part)) {
      return Number.NaN
    }

    return Number(part)
  })

  return parsed.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parsed : null
}

function isPrivateIpv4(value: string): boolean {
  const parts = parseIpv4(value)
  if (!parts) {
    return false
  }

  const [first, second, third] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

function expandIpv6Groups(value: string): number[] | null {
  const normalized = normalizeIpInput(value).split('%', 1)[0]
  if (!/^[0-9a-f:.]+$/iu.test(normalized) || !normalized.includes(':')) {
    return null
  }

  const pieces = normalized.split('::')
  if (pieces.length > 2) {
    return null
  }

  const left = pieces[0] ? pieces[0].split(':') : []
  const right = pieces[1] ? pieces[1].split(':') : []
  if ([...left, ...right].some((group) => !/^[0-9a-f]{1,4}$/iu.test(group))) {
    return null
  }

  const missing = 8 - left.length - right.length
  if (missing < 0 || (pieces.length === 1 && missing !== 0)) {
    return null
  }

  return [...left, ...Array.from({ length: missing }, () => '0'), ...right].map((group) =>
    Number.parseInt(group, 16),
  )
}

function mappedIpv4FromIpv6(value: string): string | null {
  const normalized = normalizeIpInput(value).split('%', 1)[0]
  const dottedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu)?.[1]
  if (dottedIpv4) {
    return dottedIpv4
  }

  const groups = expandIpv6Groups(normalized)
  if (groups && groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.')
  }

  return null
}

function isPrivateIpv6(value: string): boolean {
  const normalized = normalizeIpInput(value).split('%', 1)[0]
  const mappedIpv4 = mappedIpv4FromIpv6(normalized)
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4)
  }

  const groups = expandIpv6Groups(normalized)
  if (!groups) {
    return false
  }

  if (
    groups.every((group) => group === 0) ||
    (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1)
  ) {
    return true
  }

  return (
    (groups[0] & 0xfe00) === 0xfc00 ||
    (groups[0] & 0xffc0) === 0xfe80 ||
    (groups[0] === 0x2001 && groups[1] === 0x0db8)
  )
}

function isLocalOrPrivateHost(value: string): boolean {
  const normalized = normalizeIpInput(value)
  return localHostnames.has(normalized) || isPrivateIpv4(normalized) || isPrivateIpv6(normalized)
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
  if (colonCount === 1) {
    return authority.split(':', 1)[0]
  }

  if (colonCount > 1) {
    return authority
  }

  return authority
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
