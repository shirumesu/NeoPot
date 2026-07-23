import * as _deepl from './deepl'
import * as _google from './google'
import * as _ollama from './ollama'

export interface TranslateProviderOptions {
  config?: Record<string, unknown>
  detect?: string
  setResult?: (value: string) => void
}

export interface TranslateProvider {
  info: {
    icon: string
  }
  Language: Readonly<Record<string, string>>
  translate(
    text: string,
    from: string,
    to: string,
    options?: TranslateProviderOptions,
  ): Promise<unknown>
}

export const deepl = _deepl satisfies TranslateProvider
export const google = _google satisfies TranslateProvider
export const ollama = _ollama satisfies TranslateProvider
