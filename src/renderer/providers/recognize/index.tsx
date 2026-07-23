import * as _local_model from './local_model'

export interface RecognizeProvider {
  info: {
    icon: string
  }
  Language: Readonly<Record<string, string>>
  recognize(base64: string, language: string): Promise<unknown>
}

export const local_model = _local_model satisfies RecognizeProvider
