import { normalizeLingvaBaseUrl } from '@/shared/providerUrl'
import { asRecord, type ProviderResponse } from '@/renderer/providers/shared'

interface LingvaTtsOptions {
  config?: unknown
}

export interface LingvaRequestInit {
  method: 'GET'
  headers: Record<string, string>
}

export type LingvaRequest = (
  url: string,
  init: LingvaRequestInit,
) => Promise<ProviderResponse<{ statusText: string }>>

export async function synthesizeLingva(
  text: string,
  lang: string,
  options: LingvaTtsOptions = {},
  dependencies: { request: LingvaRequest },
): Promise<number[]> {
  const query = text.trim()
  if (query === '') {
    throw new Error('Cannot synthesize empty text.')
  }

  const config = asRecord(options.config)
  const baseUrl = normalizeLingvaBaseUrl(
    typeof config?.custom_url === 'string' ? config.custom_url : undefined,
  )
  const response = await dependencies.request(
    `${baseUrl}/api/v1/audio/${encodeURIComponent(lang)}/${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    },
  )

  if (!response.ok) {
    throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`)
  }

  const data = asRecord(response.data)
  const audio = data?.audio
  if (!isAudioArray(audio)) {
    throw new Error('Lingva did not return audio data.')
  }

  return audio
}

function isAudioArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
  )
}
