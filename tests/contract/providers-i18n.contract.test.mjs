import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSetEqual,
  deepKeyPaths,
  fileNames,
  parseSource,
  read,
  readJson,
  walkFiles,
} from '../shared/source.mjs'

const LOCALE_DIR = ['src', 'renderer', 'i18n', 'locales']
const REFERENCE_LOCALE = 'en_US'
const PRIMARY_COMPLETE_LOCALES = ['zh_CN']
const EXPECTED_REFERENCE_SECTIONS = [
  'accessibility',
  'app_languages',
  'common',
  'config',
  'errors',
  'languages',
  'recognize',
  'services',
  'status',
  'translate',
  'tray',
  'updater',
  'windows',
]

const translateProviders = parseSource('src', 'renderer', 'providers', 'translate', 'index.tsx')
const recognizeProviders = parseSource('src', 'renderer', 'providers', 'recognize', 'index.tsx')
const ttsProviders = parseSource('src', 'renderer', 'providers', 'tts', 'index.tsx')
const serviceTypes = parseSource('src', 'renderer', 'lib', 'service', 'service_instance.ts')
const serviceSelectPlugin = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Service',
  'SelectPluginModal',
  'index.tsx',
)
const serviceInstanceList = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Service',
  'useServiceInstanceList.ts',
)

const localeFiles = fileNames(...LOCALE_DIR).filter((name) => name.endsWith('.json'))
const localeStems = localeFiles.map((name) => name.replace(/\.json$/, ''))

function translationOf(stem) {
  const data = readJson(...LOCALE_DIR, `${stem}.json`)
  assert.ok(data && typeof data.translation === 'object', `${stem}.json has no translation root`)
  return data.translation
}

const referenceKeys = new Set(deepKeyPaths(translationOf(REFERENCE_LOCALE)))

test('runtime provider barrels expose only the intentionally supported built-ins', () => {
  assert.match(translateProviders.text, /export const deepl = _deepl/)
  assert.match(translateProviders.text, /export const google = _google/)
  assert.match(translateProviders.text, /export const ollama = _ollama/)
  assert.doesNotMatch(translateProviders.text, /bing|youdao|baidu|tencent|caiyun/i)

  assert.match(recognizeProviders.text, /export const local_model = _local_model/)
  assert.doesNotMatch(recognizeProviders.text, /tesseract|baidu|tencent|youdao/i)

  assert.match(ttsProviders.text, /export const lingva = _lingva/)
  assert.doesNotMatch(ttsProviders.text, /kokoro|piper|edge|elevenlabs/i)
})

test('live source does not import archived provider backups', () => {
  const offenders = walkFiles('src')
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => read(file).includes('spec/temp/backup') || read(file).includes('temp/backup'))

  assert.deepEqual(offenders, [])
})

test('service category model includes translate, recognize, and tts providers', () => {
  assert.match(serviceTypes.text, /TRANSLATE = 'translate'/)
  assert.match(serviceTypes.text, /RECOGNIZE = 'recognize'/)
  assert.match(serviceTypes.text, /TTS = 'tts'/)
  assert.match(serviceTypes.text, /ServiceSourceType/)
  assert.match(serviceSelectPlugin, /createServiceInstanceKey\(x, ServiceSourceType\.PLUGIN\)/)
  assert.match(serviceInstanceList, /deleteKey\(instanceKey\)/)
  assert.match(serviceInstanceList, /protectLastService/)
})

test('every locale JSON has a translation root and en_US is the canonical full key set', () => {
  for (const stem of localeStems) {
    assert.ok(translationOf(stem), stem)
  }

  assert.deepEqual(Object.keys(translationOf(REFERENCE_LOCALE)).sort(), EXPECTED_REFERENCE_SECTIONS)
  assert.ok(referenceKeys.size >= 251, `en_US reference key set shrank to ${referenceKeys.size}`)
})

test('no locale defines keys absent from en_US', () => {
  const offenders = []
  for (const stem of localeStems) {
    if (stem === REFERENCE_LOCALE) {
      continue
    }

    const extra = deepKeyPaths(translationOf(stem)).filter((key) => !referenceKeys.has(key))
    if (extra.length > 0) {
      offenders.push(`${stem}: ${extra.slice(0, 8).join(', ')}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('primary maintained locales cover every en_US key', () => {
  for (const stem of PRIMARY_COMPLETE_LOCALES) {
    assert.ok(localeStems.includes(stem), `${stem}.json must exist`)
    assertSetEqual(
      deepKeyPaths(translationOf(stem)),
      [...referenceKeys],
      `${stem} drifted from en_US key coverage`,
    )
  }
})

test('i18n resources are auto-discovered and shared with the tray menu', () => {
  const index = read('src', 'renderer', 'i18n', 'index.ts')
  const resources = read('src', 'renderer', 'i18n', 'resources.ts')
  const tray = read('src', 'main', 'modules', 'tray.ts')

  assert.match(index, /resources:\s*i18nResources/)
  assert.match(resources, /import\.meta\.glob<LocaleResourceBundle>\('\.\/locales\/\*\.json'/)
  assert.match(resources, /eager:\s*true/)
  assert.match(resources, /import:\s*'default'/)
  assert.match(tray, /translationResources as resources/)

  for (const [label, source] of [
    ['i18n/index.ts', index],
    ['i18n/resources.ts', resources],
    ['tray.ts', tray],
  ]) {
    assert.doesNotMatch(
      source,
      /from ['"][^'"]*\/locales\/\w+\.json['"]/,
      `${label} must not hand-import individual locale JSON files`,
    )
  }
})
