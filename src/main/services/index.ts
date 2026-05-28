import { addToAnki } from './collection/anki'
import { recognize as recognizeUnsupported } from './recognize'
import { translateGoogle, type GoogleTranslateRequest } from './translate/google'
import { ttsLingva } from './tts/lingva'

export type ServiceErrorCode = 'SERVICE_CONFIG_MISSING' | 'SERVICE_NOT_MIGRATED' | 'SERVICE_TIMEOUT'

export interface ServiceErrorResult {
  ok: false
  code: ServiceErrorCode
  provider?: string
  message: string
}

export interface TranslateRequest extends Partial<GoogleTranslateRequest> {
  provider?: string
}

export interface StreamToken {
  eventId: string
  value?: string
  done?: boolean
  error?: ServiceErrorResult
}

const streamListeners = new Map<string, Set<(token: StreamToken) => void>>()

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

export async function recognize(): Promise<ServiceErrorResult> {
  try {
    await recognizeUnsupported()
  } catch {
    return serviceError(
      'SERVICE_NOT_MIGRATED',
      'OCR provider is not migrated to Electron Main yet.',
      'recognize',
    )
  }

  return serviceError(
    'SERVICE_NOT_MIGRATED',
    'OCR provider is not migrated to Electron Main yet.',
    'recognize',
  )
}

export async function textToSpeech(
  text: string,
  lang: string,
  config?: { requestPath?: string },
): Promise<string | ServiceErrorResult> {
  if (!text || !lang) {
    return serviceError(
      'SERVICE_CONFIG_MISSING',
      'TTS request is missing text or language.',
      'lingva',
    )
  }

  return ttsLingva(text, lang, config)
}

export async function addToCollection(
  source: string,
  target: unknown,
  config?: { port?: number },
): Promise<void | ServiceErrorResult> {
  if (!source) {
    return serviceError(
      'SERVICE_CONFIG_MISSING',
      'Collection request is missing source text.',
      'anki',
    )
  }

  await addToAnki(source, target, config)
}

export function onServiceStream(
  eventId: string,
  callback: (token: StreamToken) => void,
): () => void {
  const listeners = streamListeners.get(eventId) ?? new Set()
  listeners.add(callback)
  streamListeners.set(eventId, listeners)

  return () => {
    listeners.delete(callback)
    if (listeners.size === 0) {
      streamListeners.delete(eventId)
    }
  }
}

export function emitServiceStream(token: StreamToken): void {
  const listeners = streamListeners.get(token.eventId)
  listeners?.forEach((listener) => listener(token))
}
