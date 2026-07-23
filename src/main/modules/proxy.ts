import { app, session } from 'electron'
import {
  createProxyRules,
  matchesProxyChallenge,
  normalizeProxyHost,
} from '../../shared/proxyConfig'
import { getConfig } from './config'

export interface ProxyConfig {
  enabled: boolean
  host?: string
  port?: number
  username?: string
  password?: string
  noProxy?: string
}

let authenticationHandlerRegistered = false

function readProxyPort(): number | undefined {
  const rawPort = getConfig('proxy_port')
  const port =
    typeof rawPort === 'number' ? rawPort : typeof rawPort === 'string' ? Number(rawPort) : NaN
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

export function getProxyConfig(): ProxyConfig {
  return {
    enabled: Boolean(getConfig('proxy_enable')),
    host: normalizeProxyHost(getConfig('proxy_host')),
    port: readProxyPort(),
    username: (getConfig('proxy_username') as string | undefined) || undefined,
    password: (getConfig('proxy_password') as string | undefined) || undefined,
    noProxy: (getConfig('no_proxy') as string | undefined) || undefined,
  }
}

export function registerProxyAuthentication(): void {
  if (authenticationHandlerRegistered) {
    return
  }
  authenticationHandlerRegistered = true

  app.on('login', (event, _webContents, _details, authInfo, callback) => {
    const proxy = getProxyConfig()
    if (
      !matchesProxyChallenge(authInfo, proxy) ||
      proxy.username === undefined ||
      proxy.password === undefined
    ) {
      return
    }

    event.preventDefault()
    callback(proxy.username, proxy.password)
  })
}

export async function applyProxyToSession(enabled?: boolean): Promise<void> {
  const proxy = getProxyConfig()
  if (!(enabled ?? proxy.enabled) || !proxy.host || !proxy.port) {
    await session.defaultSession.setProxy({ mode: 'direct' })
    await session.defaultSession.closeAllConnections()
    return
  }

  await session.defaultSession.setProxy({
    mode: 'fixed_servers',
    proxyRules: createProxyRules(proxy.host, proxy.port),
    proxyBypassRules: proxy.noProxy,
  })
  await session.defaultSession.closeAllConnections()
}
