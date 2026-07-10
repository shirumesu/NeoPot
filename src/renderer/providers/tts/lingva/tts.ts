import { normalizeLingvaBaseUrl } from '@/shared/providerUrl'

import type { Language } from './info'

interface LingvaConfig {
  custom_url?: string
}

interface LingvaTtsOptions {
  config?: LingvaConfig
}

export interface LingvaRequestInit {
  method: 'GET'
  headers: Record<string, string>
}

export interface LingvaResponse {
  ok: boolean
  status: number
  statusText: string
  data?: unknown
}

export type LingvaRequest = (url: string, init: LingvaRequestInit) => Promise<LingvaResponse>

export async function synthesizeLingva(
  text: string,
  lang: Language,
  options: LingvaTtsOptions = {},
  dependencies: { request: LingvaRequest },
): Promise<number[]> {
  const query = text.trim()
  if (query === '') {
    throw new Error('Cannot synthesize empty text.')
  }

  const baseUrl = normalizeLingvaBaseUrl(options.config?.custom_url)
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

  const data =
    typeof response.data === 'object' && response.data !== null && !Array.isArray(response.data)
      ? (response.data as Record<string, unknown>)
      : null
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
