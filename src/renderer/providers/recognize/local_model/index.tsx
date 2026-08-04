import { Language } from './info'
import type { OrtOptions } from '@paddleocr/paddleocr-js'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import { getOrCreateCachedOcr } from './ocrCache'
import { getConfiguredModelVariant, modelName, resolveVariantAssets } from './modelAssets'

const paddleLangMap: Partial<Record<string, string>> = {
  [Language.auto]: 'ch',
  [Language.zh_cn]: 'ch',
  [Language.zh_tw]: 'chinese_cht',
  [Language.en]: 'en',
  [Language.ja]: 'japan',
}

interface LocalOcrResult {
  items?: Array<{ text?: string }>
}

interface LocalOcr {
  predict(blob: Blob, options: { textRecScoreThresh: number }): Promise<LocalOcrResult[]>
}

const ocrCache = new Map<string, Promise<LocalOcr>>()

// PaddleOCR.js forwards this to onnxruntime-web, whose runtime supports a file map
// even though PaddleOCR.js declares `wasmPaths` as a string-only option.
const ortOptions = {
  backend: 'wasm',
  numThreads: 1,
  wasmPaths: {
    wasm: ortWasmUrl,
  },
} as unknown as OrtOptions

async function getOcr(language: string) {
  const paddleLang = paddleLangMap[language]
  if (!paddleLang) {
    throw new Error('Language not supported by PaddleOCR.js local model.')
  }

  const variant = await getConfiguredModelVariant()
  return getOrCreateCachedOcr(ocrCache, `${paddleLang}:${variant}`, async () => {
    const { variant: resolvedVariant, detUrl, recUrl } = await resolveVariantAssets(variant)
    const { PaddleOCR } = await import('@paddleocr/paddleocr-js')
    return PaddleOCR.create({
      lang: paddleLang,
      ocrVersion: 'PP-OCRv6',
      textDetectionModelName: modelName(resolvedVariant, 'det'),
      textDetectionModelAsset: {
        url: detUrl,
      },
      textRecognitionModelName: modelName(resolvedVariant, 'rec'),
      textRecognitionModelAsset: {
        url: recUrl,
      },
      ortOptions,
    }) as Promise<LocalOcr>
  })
}

function base64ToBlob(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: 'image/png' })
}

export async function recognize(base64: string, language: string) {
  const ocr = await getOcr(language)
  const [result] = await ocr.predict(base64ToBlob(base64), {
    textRecScoreThresh: 0.3,
  })
  const text = (result?.items ?? []).map((item) => item.text ?? '').join('\n')
  if (language === Language.zh_cn || language === Language.zh_tw || language === Language.ja) {
    return text.replaceAll(' ', '').trim()
  }
  return text.trim()
}

export * from './Config'
export * from './info'
