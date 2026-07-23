const ALLOWED_PROXY_URL_PROTOCOLS = new Set(['http:', 'https:'])
const UNSAFE_PROXY_HOST_CHARACTERS = /[\s;\\]/u
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu
const BRACKETED_IPV6_PATTERN = /^\[[0-9a-f:.]+\]$/iu

function readProxyHostInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasExplicitUrlScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(value)
}

function hasUnsafeProxyHostCharacters(value: string): boolean {
  return (
    UNSAFE_PROXY_HOST_CHARACTERS.test(value) ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 0x1f || codePoint === 0x7f
    })
  )
}

function normalizeParsedProxyHostname(hostname: string): string | undefined {
  const normalized = hostname.trim().toLowerCase()
  if (normalized === '') {
    return undefined
  }

  if (normalized.startsWith('[') || normalized.endsWith(']')) {
    return BRACKETED_IPV6_PATTERN.test(normalized) ? normalized : undefined
  }

  const withoutTrailingDot = normalized.endsWith('.') ? normalized.slice(0, -1) : normalized
  if (withoutTrailingDot.length > 253 || withoutTrailingDot.includes('..')) {
    return undefined
  }

  return withoutTrailingDot.split('.').every((label) => HOSTNAME_LABEL_PATTERN.test(label))
    ? withoutTrailingDot
    : undefined
}

export function normalizeProxyHost(value: unknown): string | undefined {
  const rawHost = readProxyHostInput(value)
  if (rawHost === '' || hasUnsafeProxyHostCharacters(rawHost)) {
    return undefined
  }

  if (!hasExplicitUrlScheme(rawHost) && rawHost.includes('://')) {
    return undefined
  }

  let url: URL
  try {
    url = new URL(hasExplicitUrlScheme(rawHost) ? rawHost : `http://${rawHost}`)
  } catch {
    return undefined
  }

  if (!ALLOWED_PROXY_URL_PROTOCOLS.has(url.protocol)) {
    return undefined
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    return undefined
  }

  return normalizeParsedProxyHostname(url.hostname)
}

function comparableProxyHost(host: string): string {
  return host
    .trim()
    .replace(/^\[|\]$/gu, '')
    .toLowerCase()
}

export function createProxyRules(host: string, port: number): string {
  return `http://${host}:${port}`
}

export function matchesProxyChallenge(
  challenge: { isProxy: boolean; host: string; port: number },
  proxy: { enabled: boolean; host?: string; port?: number },
): boolean {
  return (
    challenge.isProxy &&
    proxy.enabled &&
    proxy.host !== undefined &&
    proxy.port !== undefined &&
    comparableProxyHost(challenge.host) === comparableProxyHost(proxy.host) &&
    challenge.port === proxy.port
  )
}
