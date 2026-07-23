import assert from 'node:assert/strict'
import test from 'node:test'

import { functionText, parseSource, read } from '../shared/source.mjs'

const electronVite = read('electron.vite.config.ts')
const builder = read('electron-builder.yml')
const windowSource = parseSource('src', 'main', 'modules', 'window.ts')
const updater = parseSource('src', 'main', 'modules', 'updater.ts')
const localOcrProvider = read(
  'src',
  'renderer',
  'providers',
  'recognize',
  'local_model',
  'index.tsx',
)

test('electron-vite outputs stay aligned with packaged Main, preload, and renderer loading', () => {
  assert.match(electronVite, /outDir: 'out\/main'/)
  assert.match(electronVite, /outDir: 'out\/preload'/)
  assert.match(electronVite, /outDir: 'out\/renderer'/)
  assert.match(electronVite, /entryFileNames: '\[name\]\.cjs'/)
  assert.match(electronVite, /entryFileNames: 'index\.cjs'/)
  assert.match(
    functionText(windowSource, 'getRendererRoot'),
    /path\.join\(__dirname, '\.\.', 'renderer'\)/,
  )
  assert.match(
    functionText(windowSource, 'createBrowserWindow'),
    /path\.join\(__dirname, '\.\.', 'preload', 'index\.cjs'\)/,
  )
})

test('OCR runtime assets are bundled into renderer output and fetched from a non-file origin', () => {
  assert.match(builder, /out\/renderer\/\*\*/)
  assert.match(localOcrProvider, /PP-OCRv5_mobile_det_onnx\.tar\?url/)
  assert.match(localOcrProvider, /PP-OCRv5_mobile_rec_onnx\.tar\?url/)
  assert.match(localOcrProvider, /ort-wasm-simd-threaded\.jsep\.wasm\?url/)
  assert.match(localOcrProvider, /wasmPaths:\s*\{\s*wasm:\s*ortWasmUrl,?\s*\}/)
  assert.match(functionText(windowSource, 'rendererUrl'), /RENDERER_SCHEME/)
  assert.doesNotMatch(functionText(windowSource, 'rendererUrl'), /file:\/\//)
})

test('packaged updater modes stay aligned with Windows and Linux artifact types', () => {
  const distribution = functionText(updater, 'getDistributionMode')

  assert.match(builder, /target: AppImage/)
  assert.match(builder, /target: deb/)
  assert.match(builder, /target: rpm/)
  assert.match(builder, /target: nsis/)
  assert.match(builder, /target: portable/)
  assert.match(distribution, /distribution: 'appimage', mode: 'self-update'/)
  assert.match(distribution, /distribution: 'deb-rpm', mode: 'manual-download'/)
  assert.match(distribution, /distribution: 'installer', mode: 'self-update'/)
  assert.match(distribution, /distribution: 'portable', mode: 'manual-download'/)
})
