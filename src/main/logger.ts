import log from 'electron-log/main'

import {
  errorToLogContext,
  formatLogMessage,
  mergeLogContext,
  type AppLogger,
  type LogContext,
} from '../shared/logger'
import type { LogTransportLevel } from '../shared/logLevel'

function write(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  log[level](formatLogMessage(message, context))
}

export const logger: AppLogger = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, errorOrContext, context) => {
    if (errorOrContext instanceof Error) {
      write('error', message, mergeLogContext(context, errorToLogContext(errorOrContext)))
      return
    }

    if (errorOrContext && typeof errorOrContext === 'object' && !Array.isArray(errorOrContext)) {
      write('error', message, mergeLogContext(errorOrContext as LogContext, context))
      return
    }

    if (errorOrContext !== undefined) {
      write('error', message, mergeLogContext(context, errorToLogContext(errorOrContext)))
      return
    }

    write('error', message, context)
  },
}

export function setMainLogTransportLevel(level: LogTransportLevel): void {
  log.transports.file.level = level
  log.transports.console.level = level
}

export function getMainLogTransportLevel(): LogTransportLevel {
  return log.transports.file.level as LogTransportLevel
}
