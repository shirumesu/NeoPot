export const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'silent'] as const

export type AppLogLevel = (typeof LOG_LEVELS)[number]
export type LogTransportLevel = Exclude<AppLogLevel, 'silent'> | false

export function isLogLevel(value: unknown): value is AppLogLevel {
  return typeof value === 'string' && LOG_LEVELS.includes(value as AppLogLevel)
}

export function toLogTransportLevel(level: AppLogLevel): LogTransportLevel {
  return level === 'silent' ? false : level
}
