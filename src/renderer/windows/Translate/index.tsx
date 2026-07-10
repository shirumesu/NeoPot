import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { Spacer, Button } from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { listen } from '@/renderer/lib/electron/compat/event'
import { BsPinFill } from 'react-icons/bs'
import { useTranslation } from 'react-i18next'

import WindowControl from '../../components/WindowControl'
import ErrorPanel from '../../components/ErrorPanel'
import LanguageArea from './components/LanguageArea'
import SourceArea from './components/SourceArea'
import TargetArea from './components/TargetArea'
import { osType } from '@/renderer/lib/config/env'
import {
  DragRegion,
  LINUX_WINDOW_FRAME_CLASS,
  PIN_ICON_CLASS,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { useConfig } from '../../hooks'
import { getStoreValue, saveStore, setStoreValue } from '@/renderer/lib/config/store'
import {
  EnabledServicePluginList,
  loadEnabledServicePlugins,
} from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import type { BuiltinServices } from '@/renderer/windows/Config/pages/Service/types'
import {
  ServiceSourceType,
  isValidServiceInstanceKey,
  whetherAvailableService,
} from '@/renderer/lib/service/service_instance'
import * as builtinTranslateServices from '@/renderer/providers/translate'
import { logger } from '@/renderer/lib/logger'
const appWindow = getCurrentWebviewWindow()
const builtinTranslateServiceMap = builtinTranslateServices as BuiltinServices

type ServiceInstanceConfigMap = Record<string, Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

let blurTimeout: ReturnType<typeof setTimeout> | null = null
let moveTimeout: ReturnType<typeof setTimeout> | null = null
let skipNextBlurClose = false

const listenBlur = () => {
  return listen('neopot://blur', () => {
    if (appWindow.label === 'translate') {
      if (skipNextBlurClose) {
        skipNextBlurClose = false
        return
      }
      if (blurTimeout) {
        clearTimeout(blurTimeout)
      }
      // Close the window after 100ms, because dragging the window under windows will switch to blur and then to focus immediately.
      blurTimeout = setTimeout(async () => {
        await appWindow.close()
      }, 100)
    }
  })
}

let unlisten = listenBlur()
const unlistenBlur = () => {
  unlisten.then((f) => {
    f()
  })
}

void listen('neopot://focus', () => {
  skipNextBlurClose = false
  if (blurTimeout) {
    clearTimeout(blurTimeout)
  }
})
void listen('neopot://minimize', () => {
  skipNextBlurClose = true
})
void listen('neopot://move', () => {
  if (blurTimeout) {
    clearTimeout(blurTimeout)
  }
})

export default function Translate() {
  const { t } = useTranslation()
  const [closeOnBlur] = useConfig('translate_close_on_blur', true)
  const [alwaysOnTop] = useConfig('translate_always_on_top', false)
  const [windowPosition] = useConfig('translate_window_position', 'mouse')
  const [translateServiceInstanceList] = useConfig<string[]>('translate_service_list', [
    'deepl',
    'google',
  ])
  const [recognizeServiceInstanceList] = useConfig<string[]>('recognize_service_list', [
    'local_model',
  ])
  const [ttsServiceInstanceList] = useConfig<string[]>('tts_service_list', ['lingva'])
  const [hideLanguage] = useConfig('hide_language', false)
  const [pined, setPined] = useState(false)
  const [pluginList, setPluginList] = useState<EnabledServicePluginList>({
    translate: {},
    tts: {},
    recognize: {},
  })
  const [pluginLoadError, setPluginLoadError] = useState<string | null>(null)
  const [serviceConfigError, setServiceConfigError] = useState<string | null>(null)
  const [serviceInstanceConfigMap, setServiceInstanceConfigMap] =
    useState<ServiceInstanceConfigMap>({})
  const availableTranslateServices = useMemo(
    () => ({
      [ServiceSourceType.BUILDIN]: builtinTranslateServiceMap,
      [ServiceSourceType.PLUGIN]: pluginList.translate,
    }),
    [pluginList.translate],
  )
  const validTranslateServiceInstanceList = useMemo(
    () =>
      Array.isArray(translateServiceInstanceList)
        ? translateServiceInstanceList.filter(
            (key) =>
              isValidServiceInstanceKey(key) &&
              whetherAvailableService(key, availableTranslateServices),
          )
        : [],
    [availableTranslateServices, translateServiceInstanceList],
  )
  const validRecognizeServiceInstanceList = useMemo(
    () =>
      Array.isArray(recognizeServiceInstanceList)
        ? recognizeServiceInstanceList.filter(isValidServiceInstanceKey)
        : [],
    [recognizeServiceInstanceList],
  )
  const validTtsServiceInstanceList = useMemo(
    () =>
      Array.isArray(ttsServiceInstanceList)
        ? ttsServiceInstanceList.filter(isValidServiceInstanceKey)
        : [],
    [ttsServiceInstanceList],
  )
  const enabledTranslateServiceInstanceList = useMemo(
    () =>
      validTranslateServiceInstanceList.filter((serviceInstanceKey) => {
        const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {}
        return config.enable !== false
      }),
    [serviceInstanceConfigMap, validTranslateServiceInstanceList],
  )
  useEffect(() => {
    if (closeOnBlur !== null && !closeOnBlur) {
      unlistenBlur()
    }
  }, [closeOnBlur])
  useEffect(() => {
    if (alwaysOnTop !== null && alwaysOnTop) {
      appWindow.setAlwaysOnTop(true)
      unlistenBlur()
      setPined(true)
    }
  }, [alwaysOnTop])
  useEffect(() => {
    if (windowPosition !== null && windowPosition === 'pre_state') {
      const unlistenMove = listen('neopot://move', async () => {
        if (moveTimeout) {
          clearTimeout(moveTimeout)
        }
        moveTimeout = setTimeout(async () => {
          if (appWindow.label === 'translate') {
            const position = await appWindow.outerPosition()
            await setStoreValue('translate_window_position_x', Number(position.x), {
              save: false,
            })
            await setStoreValue('translate_window_position_y', Number(position.y), {
              save: false,
            })
            await saveStore()
          }
        }, 100)
      })
      return () => {
        unlistenMove.then((f) => {
          f()
        })
      }
    }
  }, [windowPosition])
  const loadPluginList = useCallback(async () => {
    try {
      const temp = await loadEnabledServicePlugins()
      setPluginLoadError(null)
      setPluginList({ ...temp })
    } catch (error) {
      logger.error('Failed to load translate plugin list.', error)
      setPluginLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    loadPluginList()
    if (!unlisten) {
      unlisten = listen('reload_plugin_list', loadPluginList)
    }
  }, [loadPluginList])

  const loadServiceInstanceConfigMap = useCallback(async () => {
    try {
      const serviceInstanceKeys = [
        ...new Set([
          ...validTranslateServiceInstanceList,
          ...validRecognizeServiceInstanceList,
          ...validTtsServiceInstanceList,
        ]),
      ]
      const configEntries = await Promise.all(
        serviceInstanceKeys.map(async (serviceInstanceKey) => {
          const value = await getStoreValue(serviceInstanceKey)
          return [serviceInstanceKey, isRecord(value) ? value : {}] as const
        }),
      )
      const config = Object.fromEntries(configEntries) as ServiceInstanceConfigMap
      setServiceConfigError(null)
      setServiceInstanceConfigMap(config)
    } catch (error) {
      logger.error('Failed to load translate service config map.', error)
      setServiceConfigError(error instanceof Error ? error.message : String(error))
    }
  }, [
    validRecognizeServiceInstanceList,
    validTranslateServiceInstanceList,
    validTtsServiceInstanceList,
  ])

  useEffect(() => {
    if (
      translateServiceInstanceList !== null &&
      recognizeServiceInstanceList !== null &&
      ttsServiceInstanceList !== null
    ) {
      loadServiceInstanceConfigMap()
    }
  }, [
    loadServiceInstanceConfigMap,
    translateServiceInstanceList,
    recognizeServiceInstanceList,
    ttsServiceInstanceList,
  ])

  const isServiceConfigReady =
    translateServiceInstanceList !== null &&
    recognizeServiceInstanceList !== null &&
    ttsServiceInstanceList !== null

  const hasInitError = pluginLoadError !== null || serviceConfigError !== null

  useEffect(() => {
    if (isServiceConfigReady && serviceConfigError === null) {
      appWindow.show()
    }
  }, [isServiceConfigReady, serviceConfigError])

  return (
    <div
      className={`relative flex h-screen w-screen flex-col bg-background ${LINUX_WINDOW_FRAME_CLASS}`}
    >
      <div className={`${WINDOW_TOPBAR_HEIGHT_CLASS} shrink-0`} aria-hidden="true" />
      <div className="min-h-0 flex-1 px-2">
        <div className="h-full overflow-y-auto">
          {hasInitError ? (
            <ErrorPanel
              title={t('errors.translate_window_initialization_failed')}
              messageClassName="wrap-break-word text-sm"
            >
              {`${pluginLoadError ?? ''}${
                pluginLoadError && serviceConfigError ? '\n' : ''
              }${serviceConfigError ?? ''}`}
            </ErrorPanel>
          ) : (
            <>
              <div>
                {isServiceConfigReady ? (
                  <SourceArea
                    pluginList={pluginList}
                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                  />
                ) : (
                  <div className="rounded-medium border border-default-200 bg-content1 px-4 py-3 text-sm text-default-500">
                    {t('status.loading_translation_window')}
                  </div>
                )}
              </div>
              <div className={`${hideLanguage && 'hidden'}`}>
                <LanguageArea
                  translateServiceInstanceList={enabledTranslateServiceInstanceList}
                  pluginList={pluginList}
                />
                <Spacer y={2} />
              </div>
              {isServiceConfigReady
                ? enabledTranslateServiceInstanceList.map((serviceInstanceKey, index) => {
                    return (
                      <div key={serviceInstanceKey}>
                        <TargetArea
                          index={index}
                          name={serviceInstanceKey}
                          translateServiceInstanceList={validTranslateServiceInstanceList}
                          pluginList={pluginList}
                          serviceInstanceConfigMap={serviceInstanceConfigMap}
                        />
                        <Spacer y={2} />
                      </div>
                    )
                  })
                : null}
            </>
          )}
        </div>
      </div>
      <DragRegion
        className={`absolute top-0 left-0 right-0 z-50 ${WINDOW_TOPBAR_HEIGHT_CLASS} flex w-full select-none ${
          osType === 'Darwin' ? 'justify-end' : 'justify-between'
        }`}
      >
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          disableAnimation
          className="my-auto mx-1.25 bg-transparent"
          aria-label={t(pined ? 'accessibility.unpin_window' : 'accessibility.pin_window')}
          onPress={() => {
            if (pined) {
              if (closeOnBlur) {
                unlisten = listenBlur()
              }
              appWindow.setAlwaysOnTop(false)
            } else {
              unlistenBlur()
              appWindow.setAlwaysOnTop(true)
            }
            setPined(!pined)
          }}
        >
          <BsPinFill
            className={`${PIN_ICON_CLASS} ${pined ? 'text-primary' : 'text-default-400'}`}
          />
        </Button>
        {osType !== 'Darwin' && <WindowControl />}
      </DragRegion>
    </div>
  )
}
