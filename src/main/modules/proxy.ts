import type { AxiosRequestConfig } from 'axios'
import { session } from 'electron'
import { normalizeProxyHost } from '../../shared/proxyConfig'
import { getConfig } from './config'

export interface ProxyConfig {
  enabled: boolean
  host?: string
  port?: number
  protocol?: 'http' | 'https'
  username?: string
  password?: string
  noProxy?: string
}

function readProxyPort(): number | undefined {
  const rawPort = getConfig('proxy_port')
  const port =
    typeof rawPort === 'number' ? rawPort : typeof rawPort === 'string' ? Number(rawPort) : NaN
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

export function getProxyConfig(): ProxyConfig {
  const enabled = getConfig('proxy_enable') ?? getConfig('proxy_enabled')
  return {
    enabled: Boolean(enabled),
    host: normalizeProxyHost(getConfig('proxy_host')),
    port: readProxyPort(),
    protocol: (getConfig('proxy_protocol') as 'http' | 'https' | undefined) ?? 'http',
    username: (getConfig('proxy_username') as string | undefined) ?? undefined,
    password: (getConfig('proxy_password') as string | undefined) ?? undefined,
    noProxy: (getConfig('no_proxy') as string | undefined) ?? undefined,
  }
}

function normalizeHost(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function shouldBypassProxy(config: AxiosRequestConfig, noProxy: string | undefined): boolean {
  if (!noProxy || !config.url) {
    return false
  }

  let hostname = ''
  try {
    hostname = normalizeHost(new URL(config.url, config.baseURL).hostname)
  } catch {
    return false
  }

  return noProxy
    .split(',')
    .map((entry) => normalizeHost(entry))
    .filter(Boolean)
    .some((entry) => hostname === entry || hostname.endsWith(`.${entry}`))
}

export function applyProxyToAxios(config: AxiosRequestConfig): AxiosRequestConfig {
  const proxy = getProxyConfig()
  if (!proxy.enabled || !proxy.host || !proxy.port || shouldBypassProxy(config, proxy.noProxy)) {
    return config
  }

  return {
    ...config,
    proxy: {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol,
      auth:
        proxy.username && proxy.password
          ? {
              username: proxy.username,
              password: proxy.password,
            }
          : undefined,
    },
  }
}

export async function applyProxyToSession(enabled = getProxyConfig().enabled): Promise<void> {
  const proxy = getProxyConfig()
  if (!enabled || !proxy.host || !proxy.port) {
    await session.defaultSession.setProxy({ mode: 'direct' })
    return
  }

  const proxyRules = `http=${proxy.host}:${proxy.port};https=${proxy.host}:${proxy.port}`
  await session.defaultSession.setProxy({
    mode: 'fixed_servers',
    proxyRules,
    proxyBypassRules: proxy.noProxy,
  })
}
