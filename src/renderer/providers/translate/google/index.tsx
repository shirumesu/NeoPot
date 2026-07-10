import { fetch } from '@/renderer/lib/electron/http'

import { translateGoogle, type GoogleRequest } from './translate'

export async function translate(
  text: string,
  from: string,
  to: string,
  options: Parameters<typeof translateGoogle>[3] = {},
) {
  const request: GoogleRequest = (url, init) => fetch(url, init)
  return translateGoogle(text, from, to, options, { request })
}

export * from './Config'
export * from './info'
