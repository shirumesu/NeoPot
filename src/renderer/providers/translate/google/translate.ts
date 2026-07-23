import { normalizeGoogleTranslateBaseUrl } from '@/shared/providerUrl'
import { errorMessage, responseMessage, type ProviderResponse } from '@/renderer/providers/shared'

const INVALID_RESPONSE_MESSAGE = 'Google returned an empty or malformed translation response.'

interface GoogleTranslateOptions {
  config?: Record<string, unknown>
}

export interface GoogleRichTranslationResult {
  pronunciations: Array<{ symbol: unknown; voice: string }>
  explanations: Array<{ trait: unknown; explains: unknown[] }>
  associations: unknown[]
  sentence: Array<{ source: unknown }>
}

export interface GoogleRequestInit {
  method: 'GET'
  headers: Record<string, string>
  query: Record<string, string>
}

export type GoogleRequest = (url: string, init: GoogleRequestInit) => Promise<ProviderResponse>

export async function translateGoogle(
  text: string,
  from: string,
  to: string,
  options: GoogleTranslateOptions = {},
  dependencies: { request: GoogleRequest },
): Promise<string | GoogleRichTranslationResult> {
  const customUrl = normalizeGoogleTranslateBaseUrl(
    typeof options.config?.custom_url === 'string' ? options.config.custom_url : undefined,
  )
  let response: ProviderResponse
  try {
    response = await dependencies.request(
      `${customUrl}/translate_a/single?dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t`,
      {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        query: {
          client: 'gtx',
          sl: from,
          tl: to,
          hl: to,
          ie: 'UTF-8',
          oe: 'UTF-8',
          otf: '1',
          ssel: '0',
          tsel: '0',
          kc: '7',
          q: text,
        },
      },
    )
  } catch (error) {
    throw new Error(`Google request failed: ${errorMessage(error)}`, { cause: error })
  }

  if (!response.ok) {
    throw new Error(
      `Google request failed with HTTP ${response.status}: ${responseMessage(response.data, {
        directError: 'non-object',
      })}`,
    )
  }

  return parseGoogleResponse(response.data)
}

function parseGoogleResponse(data: unknown): string | GoogleRichTranslationResult {
  const result = asArray(data)
  const segments = asArray(result?.[0])
  if (!result || !segments || segments.length === 0) {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }

  const dictionary = asArray(result[1])
  if (dictionary && dictionary.length > 0) {
    const richResult: GoogleRichTranslationResult = {
      pronunciations: [],
      explanations: [],
      associations: [],
      sentence: [],
    }

    const pronunciation = asArray(segments[1])?.[3]
    if (pronunciation !== undefined && pronunciation !== null && pronunciation !== '') {
      richResult.pronunciations.push({ symbol: pronunciation, voice: '' })
    }

    for (const entry of dictionary) {
      const row = asArray(entry)
      const explanationRows = asArray(row?.[2])
      if (!row || !explanationRows) {
        continue
      }

      richResult.explanations.push({
        trait: row[0],
        explains: explanationRows
          .map((explanation) => asArray(explanation)?.[0])
          .filter((value) => value !== undefined),
      })
    }

    const sentenceGroups = asArray(result[13])
    const sentences = asArray(sentenceGroups?.[0])
    if (sentences) {
      for (const sentence of sentences) {
        const source = asArray(sentence)?.[0]
        if (source !== undefined) {
          richResult.sentence.push({ source })
        }
      }
    }

    if (
      richResult.pronunciations.length > 0 ||
      richResult.explanations.length > 0 ||
      richResult.sentence.length > 0
    ) {
      return richResult
    }
  }

  const target = segments
    .map((segment) => asArray(segment)?.[0])
    .filter((value): value is string => typeof value === 'string')
    .join('')
    .trim()
  if (target === '') {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }
  return target
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}
