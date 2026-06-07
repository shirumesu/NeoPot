import toast from 'react-hot-toast'

import i18n from '@/renderer/i18n'
import { logger } from '@/renderer/lib/logger'
import type { LogContext } from '@/shared/logger'

interface ReportRuntimeErrorOptions {
  source: string
  logMessage?: string
  context?: LogContext
  toastId?: string
  silentToast?: boolean
}

const MAX_VISIBLE_MESSAGE_LENGTH = 160
const TOAST_DEDUP_INTERVAL_MS = 10000
const recentToastAt = new Map<string, number>()

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message
  }

  if (typeof value === 'string') {
    return value
  }

  if (value === undefined) {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function getRuntimeErrorType(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    if (typeof candidate.name === 'string' && candidate.name.trim()) {
      return candidate.name.trim()
    }
    if (typeof candidate.errorName === 'string' && candidate.errorName.trim()) {
      return candidate.errorName.trim()
    }
  }

  return typeof error === 'string' ? 'Error' : 'RuntimeError'
}

export function getRuntimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    if (typeof candidate.message === 'string') {
      return candidate.message
    }
    if (typeof candidate.reason === 'string') {
      return candidate.reason
    }
  }

  return stringifyUnknown(error)
}

function compactMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim()
}

function truncateMessage(message: string): string {
  const compacted = compactMessage(message)
  if (compacted.length <= MAX_VISIBLE_MESSAGE_LENGTH) {
    return compacted
  }

  return `${compacted.slice(0, MAX_VISIBLE_MESSAGE_LENGTH - 1).trimEnd()}...`
}

function shouldShowToast(key: string): boolean {
  const now = Date.now()
  const lastShownAt = recentToastAt.get(key)
  if (lastShownAt !== undefined && now - lastShownAt < TOAST_DEDUP_INTERVAL_MS) {
    return false
  }

  recentToastAt.set(key, now)
  return true
}

function RuntimeErrorToast({ type, message }: { type: string; message: string }) {
  return (
    <div className="min-w-[240px] max-w-[calc(100vw-72px)] sm:max-w-[456px]">
      <div className="text-sm font-medium leading-5">{i18n.t('errors.runtime_unavailable')}</div>
      <div className="mt-1 text-xs leading-4 text-default-500">
        {i18n.t('errors.runtime_details_hint')}
      </div>
      {(type || message) && (
        <div className="mt-1.5 min-w-0 rounded-small bg-default-100 px-2 py-1 font-mono text-[11px] leading-4 text-default-600">
          <div className="line-clamp-2 break-words">
            <span className="font-semibold">{type}</span>
            {message && <span>: {message}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function reportRuntimeError(error: unknown, options: ReportRuntimeErrorOptions): void {
  const type = getRuntimeErrorType(error)
  const message = truncateMessage(getRuntimeErrorMessage(error))
  const logMessage = options.logMessage ?? 'Runtime feature failed.'
  const context = {
    source: options.source,
    errorType: type,
    errorMessage: getRuntimeErrorMessage(error),
    ...(options.context ?? {}),
  }

  logger.error(logMessage, error, context)

  if (options.silentToast) {
    return
  }

  const toastKey = options.toastId ?? `${options.source}:${type}:${message}`
  if (!shouldShowToast(toastKey)) {
    return
  }

  toast.error(<RuntimeErrorToast type={type} message={message} />, {
    id: toastKey,
    style: {
      maxWidth: 'min(520px, calc(100vw - 32px))',
      width: 'fit-content',
    },
  })
}
