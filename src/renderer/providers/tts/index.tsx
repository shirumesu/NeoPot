import * as _lingva from './lingva'

export interface TtsProvider {
  info: {
    icon: string
  }
  Language: Readonly<Record<string, string>>
  tts(text: string, language: string, options?: { config?: unknown }): Promise<unknown>
}

export const lingva = _lingva satisfies TtsProvider
