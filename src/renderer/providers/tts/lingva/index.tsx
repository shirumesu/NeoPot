import { fetch } from '@/renderer/lib/electron/http'

import type { Language } from './info'
import { synthesizeLingva, type LingvaRequest } from './tts'

export { DEFAULT_LINGVA_URL } from '@/shared/providerUrl'

export async function tts(
  text: string,
  lang: Language,
  options: Parameters<typeof synthesizeLingva>[2] = {},
) {
  const request: LingvaRequest = (url, init) => fetch(url, init)
  return synthesizeLingva(text, lang, options, { request })
}

export * from './Config'
export * from './info'
