import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FileBase, readTextFile } from '@/renderer/lib/electron/files'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import type { ServiceInstanceConfigMap } from '@/renderer/lib/service/serviceConfig'
import {
  getServiceName,
  getServiceSouceType,
  isValidServiceInstanceKey,
  ServiceSourceType,
} from '@/renderer/lib/service/service_instance'
import * as builtinTtsServices from '@/renderer/providers/tts'
import type { TtsProvider } from '@/renderer/providers/tts'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'

import { useConfig } from './useConfig'
import { useVoice } from './useVoice'

const DEFAULT_TTS_SERVICE_LIST = ['lingva']
const builtinTtsServiceMap: Record<string, TtsProvider> = builtinTtsServices

export type AudioData = ArrayBuffer | ArrayLike<number>

interface PluginLanguageInfo {
  language: Record<string, string>
}

interface UseTtsSpeakOptions {
  pluginList: EnabledServicePluginList
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isAudioData(value: unknown): value is AudioData {
  return (
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array ||
    (Array.isArray(value) && value.every((item) => typeof item === 'number'))
  )
}

function assertAudioData(value: unknown): AudioData {
  if (!isAudioData(value)) {
    throw new Error('TTS provider returned invalid audio data.')
  }
  return value
}

function readPluginLanguageInfo(infoStr: string): PluginLanguageInfo | undefined {
  const parsed: unknown = JSON.parse(infoStr)
  if (!isRecord(parsed) || !isRecord(parsed.language)) {
    return undefined
  }

  return {
    language: Object.fromEntries(
      Object.entries(parsed.language).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  }
}

export function useTtsSpeak({ pluginList, serviceInstanceConfigMap }: UseTtsSpeakOptions) {
  const [ttsServiceList] = useConfig<string[]>('tts_service_list', DEFAULT_TTS_SERVICE_LIST)
  const [ttsPluginInfo, setTtsPluginInfo] = useState<PluginLanguageInfo>()
  const playVoice = useVoice()
  const { t } = useTranslation()

  const serviceInstanceKey = Array.isArray(ttsServiceList)
    ? ttsServiceList.find((key) => {
        if (!isValidServiceInstanceKey(key)) {
          return false
        }
        if (getServiceSouceType(key) === ServiceSourceType.PLUGIN) {
          return pluginList.tts?.[getServiceName(key)] !== undefined
        }
        return builtinTtsServiceMap[getServiceName(key)] !== undefined
      })
    : null

  useEffect(() => {
    if (
      serviceInstanceKey &&
      getServiceSouceType(serviceInstanceKey) === ServiceSourceType.PLUGIN
    ) {
      readTextFile(`plugins/tts/${getServiceName(serviceInstanceKey)}/info.json`, {
        baseDir: FileBase.Config,
      }).then(
        (infoStr) => {
          setTtsPluginInfo(readPluginLanguageInfo(infoStr))
        },
        () => {
          setTtsPluginInfo(undefined)
        },
      )
    }
  }, [serviceInstanceKey])

  const playAudio = useCallback(
    async (data: unknown) => {
      await playVoice(assertAudioData(data))
    },
    [playVoice],
  )

  const speak = useCallback(
    async (text: string, language: string) => {
      const instanceKey = serviceInstanceKey
      if (!instanceKey) {
        throw new Error(t('translate.tts_not_configured'))
      }

      const serviceName = getServiceName(instanceKey)
      if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
        if (!ttsPluginInfo?.language) {
          throw new Error(t('translate.tts_not_configured'))
        }
        if (!(language in ttsPluginInfo.language)) {
          throw new Error(t('errors.language_not_supported'))
        }

        const [func, utils] = await invoke_plugin('tts', serviceName)
        const data = await func(text, ttsPluginInfo.language[language], {
          config: serviceInstanceConfigMap[instanceKey],
          utils,
        })
        await playAudio(data)
        return
      }

      const builtinService = builtinTtsServiceMap[serviceName]
      if (!(language in builtinService.Language)) {
        throw new Error(t('errors.language_not_supported'))
      }
      const data = await builtinService.tts(text, builtinService.Language[language], {
        config: serviceInstanceConfigMap[instanceKey],
      })
      await playAudio(data)
    },
    [playAudio, serviceInstanceConfigMap, serviceInstanceKey, t, ttsPluginInfo],
  )

  return {
    playAudio,
    serviceInstanceKey,
    speak,
  }
}
