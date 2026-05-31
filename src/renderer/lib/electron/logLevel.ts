import log from 'electron-log/renderer'

import { getStoreValue } from '@/renderer/lib/config/store'
import { isLogLevel, toLogTransportLevel, type AppLogLevel } from '@/shared/logLevel'

export function applyRendererLogLevel(level: AppLogLevel): void {
  const transportLevel = toLogTransportLevel(level)
  log.transports.console.level = transportLevel
  log.transports.ipc.level = transportLevel
}

export async function applyConfiguredRendererLogLevel(): Promise<void> {
  const level = await getStoreValue('log_level')
  applyRendererLogLevel(isLogLevel(level) ? level : 'info')
}
