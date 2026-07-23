const localHostnames = new Set(['localhost', 'localhost.localdomain'])

export function normalizeIpInput(value: string): string {
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized
}

function parseIpv4(value: string): number[] | null {
  const parts = normalizeIpInput(value).split('.')
  if (parts.length !== 4) {
    return null
  }

  const parsed = parts.map((part) => (/^\d+$/u.test(part) ? Number(part) : Number.NaN))
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

export function isPrivateIpv6(value: string): boolean {
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

export function isBlockedNetworkAddress(value: string): boolean {
  return isPrivateIpv4(value) || isPrivateIpv6(value)
}

export function isLocalOrPrivateHost(value: string): boolean {
  const normalized = normalizeIpInput(value)
  return localHostnames.has(normalized) || isBlockedNetworkAddress(normalized)
}

export function isProxySyntheticNetworkAddress(value: string): boolean {
  const mappedIpv4 = mappedIpv4FromIpv6(value)
  const parts = parseIpv4(mappedIpv4 ?? value)
  return Boolean(parts && parts[0] === 198 && (parts[1] === 18 || parts[1] === 19))
}
