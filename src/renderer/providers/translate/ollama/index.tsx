import { fetch, Body } from '@/renderer/lib/electron/http'
import { normalizeOllamaBaseUrl } from '@/shared/providerUrl'

import { translateOllama, type OllamaRequest, type OllamaTranslateOptions } from './translate'

const OLLAMA_HEADERS = { Origin: 'http://localhost' }

export async function getModels(requestPath?: string) {
  const host = normalizeOllamaBaseUrl(requestPath)
  const res = await fetch(`${host}/api/tags`, { headers: OLLAMA_HEADERS })

  if (res.ok) {
    return res.data
  }

  throw `Failed to list models: HTTP ${res.status}`
}

export async function pullModel(requestPath: string | undefined, model: string) {
  const host = normalizeOllamaBaseUrl(requestPath)
  const res = await fetch(`${host}/api/pull`, {
    method: 'POST',
    headers: OLLAMA_HEADERS,
    body: Body.json({ name: model, stream: false }),
  })

  if (res.ok) {
    return res.data
  }

  throw `Failed to pull model: HTTP ${res.status}`
}

const request: OllamaRequest = async (url, init) =>
  fetch(url, {
    method: init.method,
    headers: init.headers,
    body: Body.json(init.body.data),
    skipData: init.skipData,
  })

export async function translate(
  text: string,
  from: string,
  to: string,
  options: OllamaTranslateOptions = {},
) {
  return translateOllama(text, from, to, options, { request })
}

export * from './Config'
export * from './info'
