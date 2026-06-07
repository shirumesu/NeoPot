import { fetch } from '@/renderer/lib/electron/http'

import { Language } from './info'

export const DEFAULT_LINGVA_URL = 'https://lingva.ml'

interface LingvaConfig {
  custom_url?: string
}

interface LingvaTtsOptions {
  config?: LingvaConfig
}

function normalizeBaseUrl(value: unknown): string {
  const rawValue = typeof value === 'string' ? value.trim() : ''
  let baseUrl = rawValue || DEFAULT_LINGVA_URL

  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`
  }

  return baseUrl.replace(/\/+$/, '')
}

function isAudioArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
  )
}

export async function tts(text: string, lang: Language, options: LingvaTtsOptions = {}) {
  const query = text.trim()
  if (query === '') {
    throw new Error('Cannot synthesize empty text.')
  }

  const baseUrl = normalizeBaseUrl(options.config?.custom_url)
  const res = await fetch(
    `${baseUrl}/api/v1/audio/${encodeURIComponent(lang)}/${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    },
  )

  if (!res.ok) {
    throw new Error(`HTTP request failed: ${res.status} ${res.statusText}`)
  }

  const audio = res.data?.audio
  if (!isAudioArray(audio)) {
    throw new Error('Lingva did not return audio data.')
  }

  return audio
}

export * from './Config'
export * from './info'
