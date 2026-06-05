export interface SafeExternalUrlOptions {
  allowedHosts?: readonly string[]
  allowedProtocols?: readonly string[]
  allowSubdomains?: boolean
}

export const defaultAllowedProtocols = ['https:', 'mailto:']

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

function isAllowedHost(
  host: string,
  allowedHosts: readonly string[],
  allowSubdomains: boolean,
): boolean {
  const normalizedHost = normalizeHost(host)
  return allowedHosts.some((allowedHost) => {
    const normalizedAllowedHost = normalizeHost(allowedHost)
    return (
      normalizedHost === normalizedAllowedHost ||
      (allowSubdomains && normalizedHost.endsWith(`.${normalizedAllowedHost}`))
    )
  })
}

export function assertSafeExternalUrl(input: string, options: SafeExternalUrlOptions = {}): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('Expected a valid external URL.')
  }

  const allowedProtocols = options.allowedProtocols ?? defaultAllowedProtocols
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`External URL protocol is not allowed: ${url.protocol}`)
  }

  if (
    url.protocol === 'https:' &&
    options.allowedHosts &&
    !isAllowedHost(url.hostname, options.allowedHosts, options.allowSubdomains !== false)
  ) {
    throw new Error(`External URL host is not allowed: ${url.hostname}`)
  }

  if (url.protocol === 'mailto:' && url.hostname === '') {
    return url.toString()
  }

  if (url.protocol === 'mailto:') {
    throw new Error('Malformed mailto URL.')
  }

  return url.toString()
}
