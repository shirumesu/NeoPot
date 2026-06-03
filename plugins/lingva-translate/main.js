function normalizeLingvaLanguage(language) {
  if (language === 'zh_cn' || language === 'zh_tw') {
    return 'zh'
  }

  return language || 'auto'
}

async function requestJson(http, url) {
  const request =
    typeof http === 'function'
      ? http
      : typeof http?.fetch === 'function'
        ? http.fetch.bind(http)
        : globalThis.fetch
  const response = await request(url, { method: 'GET' })

  if (response.ok === false) {
    throw new Error(`Lingva request failed with HTTP ${response.status ?? 'unknown'}`)
  }

  const data = response.data ?? (response.json ? await response.json() : null)
  return data && typeof data === 'object' ? data : {}
}

async function translate(text, from, to, options) {
  const source = normalizeLingvaLanguage(from)
  const target = normalizeLingvaLanguage(to)
  const encodedText = encodeURIComponent(text)
  const data = await requestJson(
    options.utils?.http,
    `https://lingva.ml/api/v1/${source}/${target}/${encodedText}`,
  )

  if (typeof data.translation !== 'string') {
    throw new Error('Lingva response did not contain a translation.')
  }

  return data.translation
}

export { translate }
