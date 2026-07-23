import { translateGoogle, type GoogleTranslateRequest } from './translate/google'

export type ServiceErrorCode = 'SERVICE_CONFIG_MISSING' | 'SERVICE_NOT_MIGRATED'

export interface ServiceErrorResult {
  ok: false
  code: ServiceErrorCode
  provider?: string
  message: string
}

export interface TranslateRequest extends Partial<GoogleTranslateRequest> {
  provider?: string
}

function serviceError(
  code: ServiceErrorCode,
  message: string,
  provider?: string,
): ServiceErrorResult {
  return {
    ok: false,
    code,
    provider,
    message,
  }
}

export async function translate(request: TranslateRequest): Promise<string | ServiceErrorResult> {
  if (!request.text || !request.from || !request.to) {
    return serviceError(
      'SERVICE_CONFIG_MISSING',
      'Translation request is missing text or language fields.',
      request.provider,
    )
  }

  switch (request.provider ?? 'google') {
    case 'google':
      return translateGoogle({
        text: request.text,
        from: request.from,
        to: request.to,
        config: request.config,
      })
    default:
      return serviceError(
        'SERVICE_NOT_MIGRATED',
        'Provider is not migrated to Electron Main yet.',
        request.provider,
      )
  }
}
