import assert from 'node:assert/strict'
import { test } from 'vitest'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { build } from 'esbuild'

async function loadTranslateServiceLanguages() {
  const result = await build({
    entryPoints: [
      path.join(
        process.cwd(),
        'src',
        'renderer',
        'lib',
        'language',
        'translateServiceLanguages.ts',
      ),
    ],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  })
  const code = result.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const { getSupportedTranslateLanguageList } = await loadTranslateServiceLanguages()

test('translate language list follows the enabled built-in service language map', () => {
  const languages = getSupportedTranslateLanguageList(['deepl'], {
    builtinServices: {
      deepl: {
        Language: {
          auto: 'auto',
          zh_cn: 'ZH-HANS',
          zh_tw: 'ZH-HANT',
          en: 'EN',
        },
      },
    },
    pluginServices: {},
  })

  assert.deepEqual(languages, ['zh_cn', 'zh_tw', 'en'])
})

test('translate language list intersects multiple current services without unsupported entries', () => {
  const languages = getSupportedTranslateLanguageList(['deepl', 'google'], {
    builtinServices: {
      deepl: {
        Language: {
          auto: 'auto',
          zh_cn: 'ZH-HANS',
          en: 'EN',
        },
      },
      google: {
        Language: {
          auto: 'auto',
          zh_cn: 'zh-CN',
          fr: 'fr',
          mn_cy: 'mn',
        },
      },
    },
    pluginServices: {},
  })

  assert.deepEqual(languages, ['zh_cn'])
})

test('translate language list can be empty when constrained services have no common target', () => {
  const languages = getSupportedTranslateLanguageList(['deepl', 'google'], {
    builtinServices: {
      deepl: {
        Language: {
          auto: 'auto',
          en: 'EN',
        },
      },
      google: {
        Language: {
          auto: 'auto',
          fr: 'fr',
        },
      },
    },
    pluginServices: {},
  })

  assert.deepEqual(languages, [])
})

test('open-ended translate services do not widen a constrained service language list', () => {
  const languages = getSupportedTranslateLanguageList(['deepl', 'ollama'], {
    builtinServices: {
      deepl: {
        Language: {
          auto: 'auto',
          zh_cn: 'ZH-HANS',
          zh_tw: 'ZH-HANT',
          en: 'EN',
        },
      },
      ollama: {},
    },
    pluginServices: {},
  })

  assert.deepEqual(languages, ['zh_cn', 'zh_tw', 'en'])
})

test('translate language list falls back to the common list for open-ended services', () => {
  const languages = getSupportedTranslateLanguageList(['ollama'], {
    builtinServices: {
      ollama: {},
    },
    pluginServices: {},
  })

  assert.ok(languages.includes('mn_mo'))
  assert.ok(languages.includes('zh_cn'))
  assert.ok(languages.includes('en'))
})
