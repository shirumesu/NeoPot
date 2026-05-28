const BODY_KIND = Symbol('electron-http-body-kind')

export const Body = {
  json(data) {
    return { [BODY_KIND]: 'json', kind: 'json', data }
  },
  text(data) {
    return { [BODY_KIND]: 'text', kind: 'text', data }
  },
  form(data) {
    return { [BODY_KIND]: 'form', kind: 'form', data }
  },
}

function appendFormValue(form, key, value) {
  if (value && typeof value === 'object' && 'file' in value) {
    const blob = new Blob([value.file], {
      type: value.mime || 'application/octet-stream',
    })
    form.append(key, blob, value.fileName || key)
    return
  }

  form.append(key, value)
}

function normalizeBody(init) {
  const headers = new Headers(init.headers || {})
  const body = init.body

  if (!body || typeof body !== 'object' || !body[BODY_KIND]) {
    return { ...init, headers }
  }

  if (body[BODY_KIND] === 'json') {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    return { ...init, headers, body: JSON.stringify(body.data) }
  }

  if (body[BODY_KIND] === 'text') {
    return { ...init, headers, body: body.data }
  }

  const form = new FormData()
  Object.entries(body.data).forEach(([key, value]) => appendFormValue(form, key, value))
  return { ...init, headers, body: form }
}

async function readResponseData(response, responseType) {
  if (responseType === 3) {
    return response.arrayBuffer()
  }

  if (responseType === 2) {
    return response.text()
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function headersToObject(headers) {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  return headers
}

function normalizeCommandBody(body) {
  if (!body || typeof body !== 'object' || !body[BODY_KIND]) {
    return body
  }

  return {
    kind: body.kind,
    data: body.data,
  }
}

function createCommandResponse(result, responseType) {
  const headers = new Headers(result.headers || {})
  const data =
    responseType === 3 && Array.isArray(result.data)
      ? new Uint8Array(result.data).buffer
      : result.data

  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    headers,
    data,
    async text() {
      return typeof data === 'string' ? data : JSON.stringify(data)
    },
    async json() {
      return typeof data === 'string' ? JSON.parse(data) : data
    },
    async arrayBuffer() {
      return data instanceof ArrayBuffer ? data : new TextEncoder().encode(String(data)).buffer
    },
    clone() {
      return createCommandResponse(result, responseType)
    },
  }
}

export async function fetch(input, init = {}) {
  const { responseType, query, skipData, ...requestInit } = init
  const url = new URL(input)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value)
      }
    })
  }

  if (window.neoPot?.command) {
    const result = await window.neoPot.command.invoke('http_request', {
      url: url.href,
      method: requestInit.method,
      headers: headersToObject(requestInit.headers),
      body: normalizeCommandBody(requestInit.body),
      responseType,
    })
    const response = createCommandResponse(result, responseType)
    return skipData ? response : response
  }

  const response = await globalThis.fetch(url.href, normalizeBody(requestInit))
  if (skipData) {
    return response
  }

  const data = await readResponseData(response.clone(), responseType)

  Object.defineProperty(response, 'data', {
    value: data,
    enumerable: true,
  })

  return response
}
