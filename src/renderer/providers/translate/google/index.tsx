import { fetch } from '@/renderer/lib/electron/http'
import { normalizeGoogleTranslateBaseUrl } from '@/shared/providerUrl'

interface GoogleTranslateOptions {
  config?: {
    custom_url?: string
  }
}

interface GoogleRichTranslationResult {
  pronunciations: Array<{ symbol: unknown; voice: string }>
  explanations: Array<{ trait: unknown; explains: unknown[] }>
  associations: unknown[]
  sentence: Array<{ source: unknown }>
}

export async function translate(
  text: string,
  from: string,
  to: string,
  options: GoogleTranslateOptions = {},
) {
  const { config } = options

  const customUrl = normalizeGoogleTranslateBaseUrl(config?.custom_url)

  const res = await fetch(
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
  if (res.ok) {
    const result = res.data
    if (result[1]) {
      const target: GoogleRichTranslationResult = {
        pronunciations: [],
        explanations: [],
        associations: [],
        sentence: [],
      }
      if (result[0][1][3]) {
        target.pronunciations.push({ symbol: result[0][1][3], voice: '' })
      }
      for (const i of result[1]) {
        target.explanations.push({
          trait: i[0],
          explains: i[2].map((x: unknown[]) => {
            return x[0]
          }),
        })
      }
      if (result[13]) {
        for (const i of result[13][0]) {
          target.sentence.push({ source: i[0] })
        }
      }
      return target
    } else {
      let target = ''
      for (const r of result[0]) {
        if (r[0]) {
          target = target + r[0]
        }
      }
      return target.trim()
    }
  } else {
    throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`
  }
}

export * from './Config'
export * from './info'
