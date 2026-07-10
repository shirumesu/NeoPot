import { normalizeOllamaBaseUrl } from '@/shared/providerUrl'

import { Language } from './info'

const OLLAMA_HEADERS = { Origin: 'http://localhost' }
const THINKING_MODE_ON = 'on'
const THINKING_MODE_OFF = 'off'
const DEFAULT_MODEL = 'gemma4:e2b'
const LEGACY_DEFAULT_MODEL = 'gemma:2b'
const INVALID_RESPONSE_MESSAGE = 'Ollama returned an empty or malformed translation response.'
const STREAM_UPDATE_INTERVAL_MS = 40

export interface PromptItem {
  role: string
  content: string
}

export type OllamaConfig = Record<string, unknown> & {
  promptList?: PromptItem[]
  model?: string
  requestPath?: string
  thinkingMode?: string
  stream?: boolean
}

export type SetResult = ((value: string) => void) | undefined

export interface OllamaTranslateOptions {
  config?: OllamaConfig
  setResult?: SetResult
  detect?: string
}

export interface OllamaRequestBody {
  kind: 'json'
  data: unknown
}

export interface OllamaRequestInit {
  method: 'POST'
  headers: Record<string, string>
  body: OllamaRequestBody
  skipData: boolean
}

export interface OllamaStreamReader {
  read: () => Promise<ReadableStreamReadResult<Uint8Array>>
}

export interface OllamaResponse {
  ok: boolean
  status: number
  data?: unknown
  body?: {
    getReader?: () => OllamaStreamReader
  }
  text: () => Promise<string>
}

export type OllamaRequest = (url: string, init: OllamaRequestInit) => Promise<OllamaResponse>

export interface OllamaDependencies {
  request: OllamaRequest
}

interface OllamaChatRequestBody {
  model: string
  messages: PromptItem[]
  stream: boolean
  options?: Record<string, number>
  think?: boolean
}

export async function translateOllama(
  text: string,
  from: string,
  to: string,
  options: OllamaTranslateOptions = {},
  dependencies: OllamaDependencies,
): Promise<string> {
  const { config = {}, setResult, detect } = options
  const model = resolveModel(config.model)
  const promptList = applyThinkingMode(
    buildPrompt(config.promptList ?? [], text, from, to, detect),
    model,
    config.thinkingMode,
  )
  const requestBody: OllamaChatRequestBody = {
    model,
    messages: promptList,
    stream: config.stream === true,
  }
  const modelOptions = buildOptions(config)
  const think = isGemma4Model(model) ? undefined : resolveThinkValue(config.thinkingMode)
  if (modelOptions) {
    requestBody.options = modelOptions
  }
  if (think !== undefined) {
    requestBody.think = think
  }

  const host = normalizeOllamaBaseUrl(config.requestPath)
  const response = await performRequest(dependencies.request, `${host}/api/chat`, {
    method: 'POST',
    headers: OLLAMA_HEADERS,
    body: { kind: 'json', data: requestBody },
    skipData: config.stream === true,
  })

  if (config.stream === true) {
    return readStreamResponse(response, setResult)
  }

  const message = asRecord(asRecord(response.data)?.message)
  const target = requireTranslation(message?.content)
  setResult?.(target)
  return target
}

function buildPrompt(
  promptList: PromptItem[],
  text: string,
  from: string,
  to: string,
  detect?: string,
): PromptItem[] {
  const detectedLanguage = detect ? ((Language as Record<string, string>)[detect] ?? detect) : ''
  return promptList.map((item) => ({
    ...item,
    content: item.content
      .replaceAll('$text', text)
      .replaceAll('$from', from)
      .replaceAll('$to', to)
      .replaceAll('$detect', detectedLanguage),
  }))
}

function parseOptionalFloat(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${fieldName}: ${String(value)}`)
  }
  return parsed
}

function parseOptionalInteger(value: unknown, fieldName: string): number | undefined {
  const parsed = parseOptionalFloat(value, fieldName)
  if (parsed === undefined) {
    return undefined
  }
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${fieldName}: ${String(value)}`)
  }
  return parsed
}

function buildOptions(config: OllamaConfig): Record<string, number> | undefined {
  const options: Record<string, number> = {}
  const temperature = parseOptionalFloat(config.temperature, 'temperature')
  const topP = parseOptionalFloat(config.topP, 'top_p')
  const topK = parseOptionalInteger(config.topK, 'top_k')

  if (temperature !== undefined) options.temperature = temperature
  if (topP !== undefined) options.top_p = topP
  if (topK !== undefined) options.top_k = topK

  return Object.keys(options).length > 0 ? options : undefined
}

function applyThinkingMode(
  promptList: PromptItem[],
  model: string,
  thinkingMode?: string,
): PromptItem[] {
  const normalizedPromptList = promptList.map((item) => ({ ...item }))
  if (!isGemma4Model(model)) {
    return normalizedPromptList
  }

  const systemIndex = normalizedPromptList.findIndex((item) => item.role === 'system')
  if (systemIndex === -1) {
    return normalizedPromptList
  }

  const systemMessage = normalizedPromptList[systemIndex]
  const strippedContent = (systemMessage.content || '').replace(/^<\|think\|>\s*/u, '')
  if (thinkingMode === THINKING_MODE_ON) {
    normalizedPromptList[systemIndex] = {
      ...systemMessage,
      content: strippedContent ? `<|think|>\n${strippedContent}` : '<|think|>',
    }
  } else if (thinkingMode === THINKING_MODE_OFF) {
    normalizedPromptList[systemIndex] = {
      ...systemMessage,
      content: strippedContent,
    }
  }

  return normalizedPromptList
}

async function performRequest(
  request: OllamaRequest,
  url: string,
  init: OllamaRequestInit,
): Promise<OllamaResponse> {
  let response: OllamaResponse
  try {
    response = await request(url, init)
  } catch (error) {
    throw new Error(`Ollama request failed: ${errorMessage(error)}`, { cause: error })
  }

  if (!response.ok) {
    throw new Error(
      `Ollama chat failed with HTTP ${response.status}: ${responseMessage(response.data)}`,
    )
  }
  return response
}

async function readStreamResponse(response: OllamaResponse, setResult: SetResult): Promise<string> {
  const state = { target: '' }
  const reader = response.body?.getReader?.()
  const resultPublisher = createThrottledResultPublisher(setResult)

  try {
    if (reader) {
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          consumeNdjsonLine(line, state, resultPublisher.publish)
        }
      }
      buffer += decoder.decode()
      consumeNdjsonLine(buffer, state, resultPublisher.publish)
    } else {
      for (const line of (await response.text()).split('\n')) {
        consumeNdjsonLine(line, state, resultPublisher.publish)
      }
    }

    const target = requireTranslation(state.target)
    resultPublisher.flush(target)
    return target
  } finally {
    resultPublisher.cancel()
  }
}

function createThrottledResultPublisher(setResult: SetResult): {
  publish: (value: string) => void
  cancel: () => void
  flush: (value: string) => void
} {
  let lastPublishedAt = Number.NEGATIVE_INFINITY
  let lastPublishedValue: string | undefined
  let pendingValue: string | undefined
  let publishTimer: ReturnType<typeof setTimeout> | null = null

  const publishPending = () => {
    publishTimer = null
    if (!setResult || pendingValue === undefined) {
      return
    }

    const value = pendingValue
    pendingValue = undefined
    lastPublishedAt = Date.now()
    lastPublishedValue = value
    setResult(value)
  }

  return {
    publish(value) {
      if (!setResult) {
        return
      }

      pendingValue = value
      const remainingDelay = STREAM_UPDATE_INTERVAL_MS - (Date.now() - lastPublishedAt)
      if (remainingDelay <= 0) {
        if (publishTimer) {
          clearTimeout(publishTimer)
        }
        publishPending()
      } else if (!publishTimer) {
        publishTimer = setTimeout(publishPending, remainingDelay)
      }
    },
    cancel() {
      if (publishTimer) {
        clearTimeout(publishTimer)
        publishTimer = null
      }
      pendingValue = undefined
    },
    flush(value) {
      if (!setResult) {
        return
      }
      if (publishTimer) {
        clearTimeout(publishTimer)
        publishTimer = null
      }
      pendingValue = undefined
      if (lastPublishedValue !== value) {
        lastPublishedAt = Date.now()
        lastPublishedValue = value
        setResult(value)
      }
    },
  }
}

function consumeNdjsonLine(
  line: string,
  state: { target: string },
  publishResult: (value: string) => void,
): void {
  if (!line.trim()) return

  let part: unknown
  try {
    part = JSON.parse(line)
  } catch {
    return
  }

  const message = asRecord(asRecord(part)?.message)
  const content = message?.content
  if (typeof content !== 'string' || content === '') return

  state.target += content
  publishResult(`${state.target}_`)
}

function requireTranslation(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }
  return value.trim()
}

function resolveModel(model?: string): string {
  return !model || model === LEGACY_DEFAULT_MODEL ? DEFAULT_MODEL : model
}

function isGemma4Model(model?: string): boolean {
  return model?.toLowerCase().startsWith('gemma4') === true
}

function resolveThinkValue(thinkingMode?: string): boolean | undefined {
  if (thinkingMode === THINKING_MODE_ON) return true
  if (thinkingMode === THINKING_MODE_OFF) return false
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function responseMessage(data: unknown): string {
  const record = asRecord(data)
  const nestedError = asRecord(record?.error)
  const message = nestedError?.message ?? record?.error ?? record?.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  if (typeof data === 'string' && data.trim()) return data.trim()
  return 'Unexpected response.'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Unknown request error.'
}
