import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { Spacer, Button } from '@heroui/react'
import { AiFillCloseCircle } from 'react-icons/ai'
import React, { useState, useEffect } from 'react'
import { listen } from '@/renderer/lib/electron/compat/event'
import { BsPinFill } from 'react-icons/bs'

import LanguageArea from './components/LanguageArea'
import SourceArea from './components/SourceArea'
import TargetArea from './components/TargetArea'
import { osType } from '@/renderer/lib/config/env'
import { useConfig } from '../../hooks'
import { getStoreValue, saveStore, setStoreValue } from '@/renderer/lib/config/store'
import {
  EnabledServicePluginList,
  loadEnabledServicePlugins,
} from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import {
  ServiceSourceType,
  isValidServiceInstanceKey,
  whetherAvailableService,
} from '@/renderer/lib/service/service_instance'
import * as builtinTranslateServices from '@/renderer/providers/translate'
import { logger } from '@/renderer/lib/logger'
const appWindow = getCurrentWebviewWindow()

let blurTimeout: ReturnType<typeof setTimeout> | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let moveTimeout: ReturnType<typeof setTimeout> | null = null

const listenBlur = () => {
  return listen('neopot://blur', () => {
    if (appWindow.label === 'translate') {
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
  if (blurTimeout) {
    clearTimeout(blurTimeout)
  }
})
void listen('neopot://move', () => {
  if (blurTimeout) {
    clearTimeout(blurTimeout)
  }
})

export default function Translate() {
  const [closeOnBlur] = useConfig('translate_close_on_blur', true)
  const [alwaysOnTop] = useConfig('translate_always_on_top', false)
  const [windowPosition] = useConfig('translate_window_position', 'mouse')
  const [rememberWindowSize] = useConfig('translate_remember_window_size', false)
  const [translateServiceInstanceList] = useConfig<string[]>('translate_service_list', [
    'deepl',
    'google',
  ])
  const [recognizeServiceInstanceList] = useConfig<string[]>('recognize_service_list', [
    'local_model',
  ])
  const [ttsServiceInstanceList] = useConfig<string[]>('tts_service_list', [])
  const [hideLanguage] = useConfig('hide_language', false)
  const [pined, setPined] = useState(false)
  const [pluginList, setPluginList] = useState<EnabledServicePluginList>({
    translate: {},
    tts: {},
    recognize: {},
  })
  const [pluginLoadError, setPluginLoadError] = useState<string | null>(null)
  const [serviceConfigError, setServiceConfigError] = useState<string | null>(null)
  const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState<Record<string, any>>({})
  const builtinTranslateServiceMap = builtinTranslateServices as Record<string, any>
  const availableTranslateServices = {
    [ServiceSourceType.BUILDIN]: builtinTranslateServiceMap,
    [ServiceSourceType.PLUGIN]: pluginList.translate,
  }
  const validTranslateServiceInstanceList = Array.isArray(translateServiceInstanceList)
    ? translateServiceInstanceList.filter(
        (key) =>
          isValidServiceInstanceKey(key) &&
          whetherAvailableService(key, availableTranslateServices),
      )
    : []
  const validRecognizeServiceInstanceList = Array.isArray(recognizeServiceInstanceList)
    ? recognizeServiceInstanceList.filter(isValidServiceInstanceKey)
    : []
  const validTtsServiceInstanceList = Array.isArray(ttsServiceInstanceList)
    ? ttsServiceInstanceList.filter(isValidServiceInstanceKey)
    : []
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
  useEffect(() => {
    if (rememberWindowSize !== null && rememberWindowSize) {
      const unlistenResize = listen('neopot://resize', async () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout)
        }
        resizeTimeout = setTimeout(async () => {
          if (appWindow.label === 'translate') {
            const size = await appWindow.outerSize()
            await setStoreValue('translate_window_height', Number(size.height), { save: false })
            await setStoreValue('translate_window_width', Number(size.width), { save: false })
            await saveStore()
          }
        }, 100)
      })
      return () => {
        unlistenResize.then((f) => {
          f()
        })
      }
    }
  }, [rememberWindowSize])

  const loadPluginList = async () => {
    try {
      const temp = await loadEnabledServicePlugins()
      setPluginLoadError(null)
      setPluginList({ ...temp })
    } catch (error) {
      logger.error('Failed to load translate plugin list.', error)
      setPluginLoadError(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => {
    loadPluginList()
    if (!unlisten) {
      unlisten = listen('reload_plugin_list', loadPluginList)
    }
  }, [])

  const loadServiceInstanceConfigMap = async () => {
    try {
      const config: Record<string, any> = {}
      for (const serviceInstanceKey of validTranslateServiceInstanceList) {
        config[serviceInstanceKey] = (await getStoreValue(serviceInstanceKey)) ?? {}
      }
      for (const serviceInstanceKey of validRecognizeServiceInstanceList) {
        config[serviceInstanceKey] = (await getStoreValue(serviceInstanceKey)) ?? {}
      }
      for (const serviceInstanceKey of validTtsServiceInstanceList) {
        config[serviceInstanceKey] = (await getStoreValue(serviceInstanceKey)) ?? {}
      }
      setServiceConfigError(null)
      setServiceInstanceConfigMap({ ...config })
    } catch (error) {
      logger.error('Failed to load translate service config map.', error)
      setServiceConfigError(error instanceof Error ? error.message : String(error))
    }
  }
  useEffect(() => {
    if (
      translateServiceInstanceList !== null &&
      recognizeServiceInstanceList !== null &&
      ttsServiceInstanceList !== null
    ) {
      loadServiceInstanceConfigMap()
    }
  }, [
    translateServiceInstanceList,
    recognizeServiceInstanceList,
    ttsServiceInstanceList,
    pluginList,
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
      className={`bg-background h-screen w-screen ${
        osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
      }`}
    >
      <div className="fixed top-1.25 left-1.25 right-1.25 h-7.5" data-tauri-drag-region="true" />
      <div
        className={`h-8.75 w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}
      >
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          disableAnimation
          className="my-auto bg-transparent"
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
          <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          disableAnimation
          className={`my-auto ${osType === 'Darwin' && 'hidden'} bg-transparent`}
          onPress={() => {
            void appWindow.close()
          }}
        >
          <AiFillCloseCircle className="text-[20px] text-default-400" />
        </Button>
      </div>
      <div
        className={`${osType === 'Linux' ? 'h-[calc(100vh-37px)]' : 'h-[calc(100vh-35px)]'} px-2`}
      >
        <div className="h-full overflow-y-auto">
          {hasInitError ? (
            <div className="rounded-medium border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              <div className="mb-2 font-semibold">Translate window initialization failed</div>
              <pre className="whitespace-pre-wrap wrap-break-word">{`${pluginLoadError ?? ''}${
                pluginLoadError && serviceConfigError ? '\n' : ''
              }${serviceConfigError ?? ''}`}</pre>
            </div>
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
                    Loading translation window...
                  </div>
                )}
              </div>
              <div className={`${hideLanguage && 'hidden'}`}>
                <LanguageArea />
                <Spacer y={2} />
              </div>
              {isServiceConfigReady
                ? validTranslateServiceInstanceList.map((serviceInstanceKey, index) => {
                    const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {}
                    const enable = config['enable'] ?? true

                    return enable ? (
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
                    ) : (
                      <React.Fragment key={serviceInstanceKey} />
                    )
                  })
                : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
