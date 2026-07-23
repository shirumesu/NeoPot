export type LogLevelName = 'debug' | 'info' | 'warn' | 'error'

export type LogContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | Record<string, unknown>
  | unknown[]

export type LogContext = Record<string, LogContextValue>

export interface AppLogger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, errorOrContext?: unknown, context?: LogContext): void
}

export const SENSITIVE_LOG_KEYS = [
  'text',
  'sourceText',
  'targetText',
  'result',
  'content',
  'body',
  'base64',
  'image',
  'imageData',
  'dataUrl',
  'token',
  'apiKey',
  'password',
  'secret',
  'authorization',
  'cookie',
]

const sensitiveKeySet = new Set(SENSITIVE_LOG_KEYS.map((key) => key.toLowerCase()))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return (
    sensitiveKeySet.has(normalized) ||
    normalized.includes('apikey') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token')
  )
}

function quoteIfNeeded(value: string): string {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value)
}

function summarizeValue(key: string, value: LogContextValue): string {
  if (isSensitiveKey(key)) {
    if (typeof value === 'string') {
      return `[redacted length=${value.length}]`
    }
    return '[redacted]'
  }

  if (value instanceof Error) {
    return quoteIfNeeded(value.message)
  }

  if (typeof value === 'string') {
    return quoteIfNeeded(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (Array.isArray(value)) {
    return `[array length=${value.length}]`
  }

  if (isRecord(value)) {
    return `[object keys=${Object.keys(value).length}]`
  }

  return quoteIfNeeded(String(value))
}

export function errorToLogContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
  }
}

export function formatLogContext(context?: LogContext): string {
  if (!context) {
    return ''
  }

  const parts = Object.entries(context)
    .filter(([key]) => key.length > 0)
    .map(([key, value]) => `${key}=${summarizeValue(key, value)}`)

  return parts.length > 0 ? parts.join(' ') : ''
}

export function formatLogMessage(message: string, context?: LogContext): string {
  const formattedContext = formatLogContext(context)
  return formattedContext ? `${message} ${formattedContext}` : message
}

export function mergeLogContext(
  context: LogContext | undefined,
  extra: LogContext | undefined,
): LogContext | undefined {
  if (!context && !extra) {
    return undefined
  }

  return {
    ...(context ?? {}),
    ...(extra ?? {}),
  }
}
