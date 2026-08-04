import tinyDetUrl from '@assets/models/ocr/PP-OCRv6_tiny_det_onnx.tar?url'
import tinyRecUrl from '@assets/models/ocr/PP-OCRv6_tiny_rec_onnx.tar?url'
import toast from 'react-hot-toast'

import i18n from '@/renderer/i18n'
import { fetch as electronFetch } from '@/renderer/lib/electron/http'
import { getStoreValue } from '@/renderer/lib/config/store'
import { logger } from '@/renderer/lib/logger'
import { errorToLogContext } from '@/shared/logger'

export const MODEL_VARIANTS = ['tiny', 'small', 'medium'] as const

export type ModelVariant = (typeof MODEL_VARIANTS)[number]

export type ModelRole = 'det' | 'rec'

export const DEFAULT_MODEL_VARIANT: ModelVariant = 'tiny'

export const MODEL_VARIANT_CONFIG_KEY = 'local_model_ocr_model_variant'

const MODEL_CDN_BASE =
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0'

const BUNDLED_TINY_ASSETS: Record<ModelRole, string> = {
  det: tinyDetUrl,
  rec: tinyRecUrl,
}

const REMOTE_MODEL_FILES: Record<Exclude<ModelVariant, 'tiny'>, Record<ModelRole, string>> = {
  small: {
    det: `${MODEL_CDN_BASE}/PP-OCRv6_small_det_onnx_infer.tar`,
    rec: `${MODEL_CDN_BASE}/PP-OCRv6_small_rec_onnx_infer.tar`,
  },
  medium: {
    det: `${MODEL_CDN_BASE}/PP-OCRv6_medium_det_onnx_infer.tar`,
    rec: `${MODEL_CDN_BASE}/PP-OCRv6_medium_rec_onnx_infer.tar`,
  },
}

const CACHE_DATABASE = 'neopot-ocr-models'
const CACHE_STORE = 'models'

const DOWNLOAD_TIMEOUT_MS = 120_000

const objectUrlCache = new Map<string, string>()
const pendingDownloads = new Map<string, Promise<string>>()

export function modelName(variant: ModelVariant, role: ModelRole): string {
  return `PP-OCRv6_${variant}_${role}`
}

export async function getConfiguredModelVariant(): Promise<ModelVariant> {
  try {
    const value = await getStoreValue(MODEL_VARIANT_CONFIG_KEY)
    if (typeof value === 'string' && (MODEL_VARIANTS as readonly string[]).includes(value)) {
      return value as ModelVariant
    }
  } catch (error) {
    logger.warn('Failed to read OCR model variant config.', {
      ...errorToLogContext(error),
      key: MODEL_VARIANT_CONFIG_KEY,
    })
  }
  return DEFAULT_MODEL_VARIANT
}

function openCacheDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CACHE_STORE)) {
        request.result.createObjectStore(CACHE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open model cache.'))
  })
}

async function readCachedModel(key: string): Promise<ArrayBuffer | undefined> {
  const database = await openCacheDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(CACHE_STORE, 'readonly')
        .objectStore(CACHE_STORE)
        .get(key)
      request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

async function writeCachedModel(key: string, bytes: ArrayBuffer): Promise<void> {
  const database = await openCacheDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readwrite')
      transaction.objectStore(CACHE_STORE).put(bytes, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function fetchAndCacheModel(key: string, url: string): Promise<string> {
  const cached = await readCachedModel(key).catch((error) => {
    logger.warn('Failed to read OCR model cache.', { ...errorToLogContext(error), key })
    return undefined
  })

  let bytes = cached
  if (!bytes) {
    const bytesPromise = electronFetch<ArrayBuffer>(url, {
      responseType: 3,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to download ${key}: HTTP ${String(res.status)}`)
      }
      return res.data
    })
    bytes = await withTimeout(
      bytesPromise,
      DOWNLOAD_TIMEOUT_MS,
      `Download of ${key} timed out after ${String(DOWNLOAD_TIMEOUT_MS)} ms`,
    )
    await writeCachedModel(key, bytes).catch((error) => {
      logger.warn('Failed to persist OCR model cache.', { ...errorToLogContext(error), key })
    })
  }

  return URL.createObjectURL(new Blob([bytes]))
}

async function getCachedRemoteModelUrl(key: string, url: string): Promise<string> {
  const existing = objectUrlCache.get(key)
  if (existing) {
    return existing
  }

  const pending = pendingDownloads.get(key)
  if (pending) {
    return pending
  }

  const download = fetchAndCacheModel(key, url)
    .then((objectUrl) => {
      objectUrlCache.set(key, objectUrl)
      return objectUrl
    })
    .finally(() => {
      if (pendingDownloads.get(key) === download) {
        pendingDownloads.delete(key)
      }
    })
  pendingDownloads.set(key, download)
  return download
}

export async function resolveVariantAssets(
  variant: ModelVariant,
): Promise<{ variant: ModelVariant; detUrl: string; recUrl: string }> {
  if (variant === 'tiny') {
    return { variant, detUrl: BUNDLED_TINY_ASSETS.det, recUrl: BUNDLED_TINY_ASSETS.rec }
  }

  const detName = modelName(variant, 'det')
  const recName = modelName(variant, 'rec')
  if (objectUrlCache.has(detName) && objectUrlCache.has(recName)) {
    return {
      variant,
      detUrl: objectUrlCache.get(detName) as string,
      recUrl: objectUrlCache.get(recName) as string,
    }
  }

  const notifyId = `ocr-model-download-${variant}`
  toast.loading(i18n.t('services.recognize.local_model.model_downloading', { variant }), {
    id: notifyId,
  })
  try {
    const [detUrl, recUrl] = await Promise.all([
      getCachedRemoteModelUrl(detName, REMOTE_MODEL_FILES[variant].det),
      getCachedRemoteModelUrl(recName, REMOTE_MODEL_FILES[variant].rec),
    ])
    toast.success(i18n.t('services.recognize.local_model.model_ready', { variant }), {
      id: notifyId,
      duration: 2000,
    })
    return { variant, detUrl, recUrl }
  } catch (error) {
    toast.error(i18n.t('services.recognize.local_model.model_fallback', { variant }), {
      id: notifyId,
      duration: 4000,
    })
    logger.warn('Falling back to bundled tiny model after variant download failure.', {
      ...errorToLogContext(error),
      variant,
    })
    return { variant: 'tiny', detUrl: BUNDLED_TINY_ASSETS.det, recUrl: BUNDLED_TINY_ASSETS.rec }
  }
}
