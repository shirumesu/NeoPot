import { fetch, Body } from '@/renderer/lib/electron/http'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { getStoreValue } from '../config/store'
import { invoke_plugin } from '../plugin/invoke_plugin'
import { reportRuntimeError } from '../runtimeError'

function requestId() {
  return crypto.randomUUID().replaceAll('-', '')
}

type LanguageMap = Record<string, string>

// https://fanyi-api.baidu.com/product/113
async function baidu_detect(text: string) {
  const lang_map: LanguageMap = {
    zh: 'zh_cn',
    cht: 'zh_tw',
    en: 'en',
    jp: 'ja',
    kor: 'ko',
    fra: 'fr',
    spa: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt_pt',
    vie: 'vi',
    id: 'id',
    th: 'th',
    may: 'ms',
    ar: 'ar',
    hi: 'hi',
    nob: 'nb_no',
    nno: 'nn_no',
    per: 'fa',
    ukr: 'uk',
  }
  const res = await fetch('https://fanyi.baidu.com/langdetect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Body.form({
      query: text,
    }),
  })
  if (res.ok) {
    const result = res.data
    if (result.lan && result.lan in lang_map) {
      return lang_map[result.lan]
    }
  }
  return 'en'
}
// https://cloud.tencent.com/document/product/551/15619
async function tencent_detect(text: string) {
  const lang_map: LanguageMap = {
    zh: 'zh_cn',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt_pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
  }
  const res = await fetch('https://fanyi.qq.com/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Body.form({
      sourceText: text,
    }),
  })
  if (res.ok) {
    const result = res.data
    if (result.translate && result.translate.source && result.translate.source in lang_map) {
      return lang_map[result.translate.source]
    }
  }
  return 'en'
}
// https://cloud.google.com/translate/docs/languages?hl=zh-cn
async function google_detect(text: string) {
  const lang_map: LanguageMap = {
    'zh-CN': 'zh_cn',
    'zh-TW': 'zh_tw',
    ja: 'ja',
    en: 'en',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt_pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    mn: 'mn_cy',
    km: 'km',
    fa: 'fa',
    no: 'nb_no',
    uk: 'uk',
  }
  const res = await fetch(
    `https://translate.google.com/translate_a/single?dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t`,
    {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      query: {
        client: 'gtx',
        sl: 'auto',
        tl: 'zh-CN',
        hl: 'zh-CN',
        ie: 'UTF-8',
        oe: 'UTF-8',
        otf: '1',
        ssel: '0',
        tsel: '0',
        kc: '7',
        q: text,
      },
    },
  )
  if (res.ok) {
    const result = res.data
    if (result[2] && result[2] in lang_map) {
      return lang_map[result[2]]
    }
  }
  return 'en'
}
// https://niutrans.com/documents/contents/trans_text#languageList
async function niutrans_detect(text: string) {
  const lang_map: LanguageMap = {
    zh: 'zh_cn',
    cht: 'zh_cn',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt_pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    mn: 'mn_cy',
    mo: 'mn_mo',
    km: 'km',
    nb: 'nb_no',
    nn: 'nn_no',
    fa: 'fa',
    uk: 'uk',
  }
  const res = await fetch('https://test.niutrans.com/NiuTransServer/language', {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    query: {
      src_text: text,
      source: 'text',
      time: new String(new Date().getTime()),
    },
  })
  if (res.ok) {
    const result = res.data
    if (result['language'] && result['language'] in lang_map) {
      return lang_map[result['language']]
    }
  }
  return 'en'
}
// https://yandex.com/dev/translate/doc/en/concepts/api-overview
async function yandex_detect(text: string) {
  const lang_map: LanguageMap = {
    zh: 'zh_cn',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt_pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    no: 'nb_no',
    fa: 'fa',
    uk: 'uk',
  }

  const res = await fetch('https://translate.yandex.net/api/v1/tr.json/detect', {
    method: 'GET',
    query: {
      id: requestId() + '-0-0',
      srv: 'android',
      text: text,
    },
  })
  if (res.ok) {
    const result = res.data
    if (result['lang'] && result['lang'] in lang_map) {
      return lang_map[result['lang']]
    }
  }
  return 'en'
}
// https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
async function bing_detect(text: string) {
  const lang_map: LanguageMap = {
    'zh-Hans': 'zh_cn',
    'zh-Hant': 'zh_tw',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    'pt-pt': 'pt_pt',
    pt: 'pt_br',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    'mn-Cyrl': 'mn_cy',
    'mn-Mong': 'mn_mo',
    km: 'km',
    nb: 'nb_no',
    fa: 'fa',
    uk: 'uk',
  }
  const token_url = 'https://edge.microsoft.com/translate/auth'

  const token = await fetch(token_url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
    },
    responseType: 2,
  })
  if (token.ok) {
    const url = 'https://api-edge.cognitive.microsofttranslator.com/detect'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'zh-TW,zh;q=0.9,ja;q=0.8,zh-CN;q=0.7,en-US;q=0.6,en;q=0.5',
        authorization: 'Bearer ' + token.data,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        pragma: 'no-cache',
        'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        Referer: 'https://appsumo.com/',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
      },
      query: {
        'api-version': '3.0',
      },
      body: { type: 'Json', payload: [{ Text: text }] },
    })

    if (res.ok) {
      const result = res.data
      if (result[0].language && result[0].language in lang_map) {
        return lang_map[result[0].language]
      }
    }
  }
  return 'en'
}

async function local_detect(text: string) {
  return await invoke('lang_detect', { text: text })
}

async function fallbackLocalDetect(text: string, failedEngine: string) {
  try {
    return await local_detect(text)
  } catch (error) {
    reportRuntimeError(error, {
      source: 'language.detect.local',
      logMessage: 'Local language detection fallback failed.',
      toastId: 'language.detect.local',
      context: {
        failedEngine,
        inputLength: text.length,
      },
    })
    return 'en'
  }
}

async function plugin_detect(text: string, pluginName: string) {
  try {
    const [func, utils] = await invoke_plugin('lang_detect', pluginName)
    const result = await func(text, {
      utils,
    })
    return typeof result === 'string' && result
      ? result
      : await fallbackLocalDetect(text, `plugin:${pluginName}`)
  } catch (error) {
    reportRuntimeError(error, {
      source: 'language.detect.plugin',
      logMessage: 'Plugin language detection failed.',
      toastId: `language.detect.plugin:${pluginName}`,
      context: {
        pluginName,
        inputLength: text.length,
      },
    })
    return await fallbackLocalDetect(text, `plugin:${pluginName}`)
  }
}

export default async function detect(text: string) {
  const langDetectEngine = (await getStoreValue('translate_detect_engine')) ?? 'local'

  if (typeof langDetectEngine === 'string' && langDetectEngine.startsWith('plugin:')) {
    return await plugin_detect(text, langDetectEngine.slice('plugin:'.length))
  }

  try {
    switch (langDetectEngine) {
      case 'baidu':
        return await baidu_detect(text)
      case 'google':
        return await google_detect(text)
      case 'local':
        return await local_detect(text)
      case 'tencent':
        return await tencent_detect(text)
      case 'niutrans':
        return await niutrans_detect(text)
      case 'yandex':
        return await yandex_detect(text)
      case 'bing':
        return await bing_detect(text)
      default:
        return await local_detect(text)
    }
  } catch (error) {
    const engine = typeof langDetectEngine === 'string' ? langDetectEngine : 'local'
    reportRuntimeError(error, {
      source: 'language.detect',
      logMessage: 'Language detection failed.',
      toastId: `language.detect:${engine}`,
      context: {
        engine,
        inputLength: text.length,
      },
    })
    return engine === 'local' ? 'en' : await fallbackLocalDetect(text, engine)
  }
}
