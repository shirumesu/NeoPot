import type { AxiosRequestConfig } from 'axios'
import { getConfig } from './config'

export interface ProxyConfig {
  enabled: boolean
  host?: string
  port?: number
  protocol?: 'http' | 'https'
}

export function getProxyConfig(): ProxyConfig {
  return {
    enabled: Boolean(getConfig('proxy_enabled')),
    host: (getConfig('proxy_host') as string | undefined) ?? undefined,
    port: (getConfig('proxy_port') as number | undefined) ?? undefined,
    protocol: (getConfig('proxy_protocol') as 'http' | 'https' | undefined) ?? 'http',
  }
}

export function applyProxyToAxios(config: AxiosRequestConfig): AxiosRequestConfig {
  const proxy = getProxyConfig()
  if (!proxy.enabled || !proxy.host || !proxy.port) {
    return config
  }

  return {
    ...config,
    proxy: {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol,
    },
  }
}

export function applyProxyToFetch(init: RequestInit = {}): RequestInit {
  return init
}
