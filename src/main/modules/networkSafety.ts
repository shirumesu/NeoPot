import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import {
  isBlockedNetworkAddress,
  isLocalOrPrivateHost,
  isProxySyntheticNetworkAddress,
  normalizeIpInput,
} from '../../shared/networkAddress'

type ResolvedAddress = { address: string }

interface HttpUrlSafetyOptions {
  allowPrivateNetwork?: boolean
  resolveHostname?: (hostname: string) => Promise<ResolvedAddress[]>
}

export { isBlockedNetworkAddress }

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
  if (!options.allowPrivateNetwork && isLocalOrPrivateHost(hostname)) {
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
