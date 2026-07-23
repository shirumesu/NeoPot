import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { Spacer } from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAppEvent } from '@/renderer/lib/electron/events'
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
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { PinButton, useCloseOnBlur } from '@/renderer/components/WindowPinning'
import { useConfig } from '../../hooks'
import { setStoreValue } from '@/renderer/lib/config/store'
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
import {
  loadServiceInstanceConfigMap,
  type ServiceInstanceConfigMap,
} from '@/renderer/lib/service/serviceConfig'
const appWindow = getCurrentWindow()
const builtinTranslateServiceMap = builtinTranslateServices as BuiltinServices

let moveTimeout: ReturnType<typeof setTimeout> | null = null

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
  const { isPinned, togglePinned } = useCloseOnBlur({
    enabled: closeOnBlur === true,
    delayMs: 100,
    initiallyPinned: alwaysOnTop === true,
  })
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
    if (windowPosition !== null && windowPosition === 'pre_state') {
      const unlistenMove = onAppEvent('neopot://move', async () => {
        if (moveTimeout) {
          clearTimeout(moveTimeout)
        }
        moveTimeout = setTimeout(async () => {
          const position = await appWindow.outerPosition()
          await setStoreValue('translate_window_position_x', Number(position.x))
          await setStoreValue('translate_window_position_y', Number(position.y))
        }, 100)
      })
      return unlistenMove
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
    void loadPluginList()
    return onAppEvent('reload_plugin_list', loadPluginList)
  }, [loadPluginList])

  const refreshServiceInstanceConfigMap = useCallback(async () => {
    try {
      const serviceInstanceKeys = [
        ...new Set([
          ...validTranslateServiceInstanceList,
          ...validRecognizeServiceInstanceList,
          ...validTtsServiceInstanceList,
        ]),
      ]
      const config = await loadServiceInstanceConfigMap(serviceInstanceKeys)
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
      void refreshServiceInstanceConfigMap()
    }
  }, [
    refreshServiceInstanceConfigMap,
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
              <div className={hideLanguage ? 'hidden' : ''}>
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
        <PinButton isPinned={isPinned} onToggle={togglePinned} />
        {osType !== 'Darwin' && <WindowControl />}
      </DragRegion>
    </div>
  )
}
