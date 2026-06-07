import { invoke } from '@/renderer/lib/electron/compat/core'
import { getStoreValue } from '../config/store'
import { invoke_plugin } from '../plugin/invoke_plugin'
import { reportRuntimeError } from '../runtimeError'

async function local_detect(text: string) {
  return await invoke('lang_detect', { text })
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
    return await local_detect(text)
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
    return 'en'
  }
}
