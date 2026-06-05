import log from 'electron-log/renderer'

import {
  errorToLogContext,
  formatLogMessage,
  mergeLogContext,
  type AppLogger,
  type LogContext,
} from '@/shared/logger'

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

export function createPluginLogger(context: { pluginType: string; pluginName: string }): AppLogger {
  const withPluginContext = (extra?: LogContext): LogContext => ({
    pluginType: context.pluginType,
    pluginName: context.pluginName,
    ...(extra ?? {}),
  })

  return {
    debug: (message, extra) => logger.debug(`Plugin ${message}`, withPluginContext(extra)),
    info: (message, extra) => logger.info(`Plugin ${message}`, withPluginContext(extra)),
    warn: (message, extra) => logger.warn(`Plugin ${message}`, withPluginContext(extra)),
    error: (message, errorOrContext, extra) =>
      logger.error(`Plugin ${message}`, errorOrContext, withPluginContext(extra)),
  }
}
