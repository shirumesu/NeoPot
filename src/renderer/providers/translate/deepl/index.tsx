import { fetch, Body } from '@/renderer/lib/electron/http'
import { translateDeepL, type DeepLRequest, type DeepLTranslateOptions } from './translate'

const request: DeepLRequest = async (url, init) => {
  const body = init.body.kind === 'json' ? Body.json(init.body.data) : Body.text(init.body.data)
  return fetch(url, {
    method: init.method,
    body,
    headers: init.headers,
  })
}

export async function translate(
  text: string,
  from: string,
  to: string,
  options: DeepLTranslateOptions = {},
) {
  return translateDeepL(text, from, to, options, { request })
}

export * from './Config'
export * from './info'
