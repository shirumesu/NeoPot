import { open, rm } from 'node:fs/promises'

import { PluginInstallError } from './pluginInstallerCore'

export const REMOTE_PLUGIN_FETCH_TIMEOUT_MS = 30_000
export const REMOTE_PLUGIN_MAX_COMPRESSED_BYTES = 128 * 1024 * 1024
export const REMOTE_PLUGIN_MAX_MANIFEST_BYTES = 1024 * 1024

interface RemotePluginFetchOptions {
  operation: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

interface RemotePluginDownloadOptions {
  maxBytes?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
  operation?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`
  }
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MiB`
  }
  if (bytes % 1024 === 0) {
    return `${bytes / 1024} KiB`
  }
  return `${bytes} bytes`
}

function formatDuration(milliseconds: number): string {
  return milliseconds % 1000 === 0 ? `${milliseconds / 1000} seconds` : `${milliseconds} ms`
}

function assertResponseSize(response: Response, maxBytes: number, operation: string): void {
  const contentLength = response.headers.get('content-length')
  if (!contentLength) {
    return
  }

  const declaredBytes = Number.parseInt(contentLength, 10)
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `${operation} exceeded the ${formatBytes(maxBytes)} compressed-byte limit.`,
    )
  }
}

function assertBytesWithinLimit(bytes: number, maxBytes: number, operation: string): void {
  if (bytes > maxBytes) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `${operation} exceeded the ${formatBytes(maxBytes)} compressed-byte limit.`,
    )
  }
}

export async function fetchRemotePluginResource<T>(
  source: string,
  consume: (response: Response) => Promise<T>,
  {
    operation,
    timeoutMs = REMOTE_PLUGIN_FETCH_TIMEOUT_MS,
    fetchImpl = fetch,
  }: RemotePluginFetchOptions,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(source, { signal: controller.signal })
    if (!response.ok) {
      throw new PluginInstallError(
        'PLUGIN_INVALID_PACKAGE',
        `${operation} failed with HTTP ${response.status}.`,
      )
    }
    return await consume(response)
  } catch (error) {
    if (error instanceof PluginInstallError) {
      throw error
    }
    if (timedOut) {
      throw new PluginInstallError(
        'PLUGIN_INVALID_PACKAGE',
        `${operation} timed out after ${formatDuration(timeoutMs)}.`,
      )
    }
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function readRemotePluginResponse(
  response: Response,
  maxBytes: number,
  operation: string,
): Promise<Buffer> {
  assertResponseSize(response, maxBytes, operation)
  if (!response.body) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `${operation} returned an empty response body.`,
    )
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      totalBytes += value.byteLength
      assertBytesWithinLimit(totalBytes, maxBytes, operation)
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  )
}

export async function streamRemotePluginResponseToFile(
  response: Response,
  targetFile: string,
  maxBytes: number,
  operation: string,
): Promise<number> {
  assertResponseSize(response, maxBytes, operation)
  if (!response.body) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `${operation} returned an empty response body.`,
    )
  }

  const reader = response.body.getReader()
  const file = await open(targetFile, 'wx')
  let completed = false
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      totalBytes += value.byteLength
      assertBytesWithinLimit(totalBytes, maxBytes, operation)
      await file.write(value)
    }
    completed = true
    return totalBytes
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
    try {
      await file.close()
    } finally {
      if (!completed) {
        await rm(targetFile, { force: true })
      }
    }
  }
}

export async function downloadRemotePluginFile(
  source: string,
  targetFile: string,
  {
    maxBytes = REMOTE_PLUGIN_MAX_COMPRESSED_BYTES,
    timeoutMs,
    fetchImpl,
    operation = 'Plugin download',
  }: RemotePluginDownloadOptions = {},
): Promise<number> {
  return fetchRemotePluginResource(
    source,
    (response) => streamRemotePluginResponseToFile(response, targetFile, maxBytes, operation),
    { operation, timeoutMs, fetchImpl },
  )
}
