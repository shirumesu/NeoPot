import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const localHostnames = new Set(['localhost', 'localhost.localdomain'])

type ResolvedAddress = { address: string }

interface HttpUrlSafetyOptions {
  allowPrivateNetwork?: boolean
  resolveHostname?: (hostname: string) => Promise<ResolvedAddress[]>
}

function normalizeIpInput(address: string): string {
  const normalized = address.trim().toLowerCase()
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized
}

function parseIpv4(address: string): number[] | null {
  const normalized = normalizeIpInput(address)
  if (isIP(normalized) !== 4) {
    return null
  }

  const parts = normalized.split('.').map((part) => Number(part))
  return parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null
}

function isPrivateIpv4(address: string): boolean {
  const parts = parseIpv4(address)
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

function parseIpv6Groups(address: string): number[] | null {
  const normalized = normalizeIpInput(address).split('%', 1)[0]
  if (isIP(normalized) !== 6) {
    return null
  }

  const pieces = normalized.split('::')
  if (pieces.length > 2) {
    return null
  }

  const left = pieces[0] ? pieces[0].split(':') : []
  const right = pieces[1] ? pieces[1].split(':') : []
  const missing = 8 - left.length - right.length
  if (missing < 0 || (pieces.length === 1 && missing !== 0)) {
    return null
  }

  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right]
  if (groups.length !== 8) {
    return null
  }

  return groups.map((group) => Number.parseInt(group, 16))
}

function mappedIpv4FromIpv6(address: string): string | null {
  const normalized = normalizeIpInput(address).split('%', 1)[0]
  const dottedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (dottedIpv4) {
    return dottedIpv4
  }

  const groups = parseIpv6Groups(normalized)
  if (groups && groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.')
  }

  return null
}

function isProxySyntheticIpv4(address: string): boolean {
  const parts = parseIpv4(address)
  if (!parts) {
    return false
  }

  const [first, second] = parts
  return first === 198 && (second === 18 || second === 19)
}

function isProxySyntheticNetworkAddress(address: string): boolean {
  return isProxySyntheticIpv4(address) || isProxySyntheticIpv4(mappedIpv4FromIpv6(address) ?? '')
}

function isPrivateIpv6(address: string): boolean {
  if (isIP(normalizeIpInput(address)) !== 6) {
    return false
  }

  const normalized = normalizeIpInput(address).split('%', 1)[0]
  if (normalized === '::' || normalized === '::1') {
    return true
  }

  const mappedIpv4 = mappedIpv4FromIpv6(normalized)
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4)
  }

  return (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('2001:db8:')
  )
}

export function isBlockedNetworkAddress(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address)
}

function assertAllowedHttpProtocol(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`HTTP request protocol is not allowed: ${url.protocol}`)
  }
}

export function assertPublicHttpUrl(input: string, options: HttpUrlSafetyOptions = {}): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('Expected a valid HTTP request URL.')
  }

  assertAllowedHttpProtocol(url)

  const hostname = normalizeIpInput(url.hostname)
  if (
    !options.allowPrivateNetwork &&
    (localHostnames.has(hostname) || isBlockedNetworkAddress(hostname))
  ) {
    throw new Error(`HTTP request target is not allowed: ${hostname}`)
  }

  return url
}

export async function assertPublicHttpRequestUrl(
  input: string,
  options: HttpUrlSafetyOptions = {},
): Promise<URL> {
  const url = assertPublicHttpUrl(input, options)

  if (options.allowPrivateNetwork) {
    return url
  }

  if (isIP(url.hostname) !== 0) {
    return url
  }

  const addresses = options.resolveHostname
    ? await options.resolveHostname(url.hostname)
    : await lookup(url.hostname, {
        all: true,
        verbatim: true,
      })

  const blockedAddress = addresses.find(
    (address) =>
      isBlockedNetworkAddress(address.address) && !isProxySyntheticNetworkAddress(address.address),
  )
  if (blockedAddress) {
    throw new Error(`HTTP request resolved to a blocked address: ${blockedAddress.address}`)
  }

  return url
}
