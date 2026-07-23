export type ProviderResponse<Extra extends object = object> = {
  ok: boolean
  status: number
  data?: unknown
} & Extra

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }
  return 'Unknown request error.'
}

export function responseMessage(
  data: unknown,
  options: { directError?: 'any' | 'non-object' } = {},
): string {
  const record = asRecord(data)
  const nestedError = asRecord(record?.error)
  const directError =
    options.directError === 'any' ||
    (options.directError === 'non-object' && record?.error !== undefined && !nestedError)
      ? record?.error
      : undefined
  const message = nestedError?.message ?? directError ?? record?.message

  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }
  if (typeof data === 'string' && data.trim()) {
    return data.trim()
  }
  return 'Unexpected response.'
}
