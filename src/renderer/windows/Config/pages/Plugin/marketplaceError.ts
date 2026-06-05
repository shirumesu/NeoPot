export type MarketplaceSourceErrorKind =
  | 'http'
  | 'invalid-index'
  | 'local-json'
  | 'missing'
  | 'unavailable'
  | 'unknown'

export interface MarketplaceSourceErrorDescriptor {
  kind: MarketplaceSourceErrorKind
  message: string
  status?: number
}

const IPC_REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*/i

export function cleanIpcErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const message = rawMessage.replace(IPC_REMOTE_ERROR_PREFIX, '').trim()

  if (!message || message === '[object Object]') {
    return 'Marketplace source is unavailable.'
  }

  return message
}

export function describeMarketplaceSourceError(error: unknown): MarketplaceSourceErrorDescriptor {
  const message = cleanIpcErrorMessage(error)
  const httpStatus = message.match(/Marketplace index request failed with HTTP (\d+)/i)

  if (httpStatus) {
    const status = Number.parseInt(httpStatus[1], 10)
    return {
      kind: 'http',
      status,
      message: `Marketplace source returned HTTP ${status}.`,
    }
  }

  if (/Marketplace index must be an array of complete plugin entries/i.test(message)) {
    return {
      kind: 'invalid-index',
      message: 'Marketplace index format is invalid.',
    }
  }

  if (/Local marketplace sources must be JSON files/i.test(message)) {
    return {
      kind: 'local-json',
      message,
    }
  }

  if (/(ENOENT|no such file|cannot find path|not found)/i.test(message)) {
    return {
      kind: 'missing',
      message: 'Marketplace source file was not found.',
    }
  }

  if (message === 'Marketplace source is unavailable.') {
    return {
      kind: 'unavailable',
      message,
    }
  }

  return {
    kind: 'unknown',
    message,
  }
}
