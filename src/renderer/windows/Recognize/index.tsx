import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { useCallback, useState, useEffect } from 'react'
import { listen } from '@/renderer/lib/electron/compat/event'
import { Button } from '@heroui/react'
import { BsPinFill } from 'react-icons/bs'
import { atom, useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'

import WindowControl from '../../components/WindowControl'
import ErrorPanel from '../../components/ErrorPanel'
import { getStoreValue } from '@/renderer/lib/config/store'
import { osType } from '@/renderer/lib/config/env'
import {
  LINUX_WINDOW_FRAME_CLASS,
  PIN_ICON_CLASS,
  TopDragRegion,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { useConfig } from '../../hooks'
import ControlArea from './ControlArea'
import ImageArea from './ImageArea'
import TextArea from './TextArea'
import { logger } from '@/renderer/lib/logger'
import { loadInstalledPlugins, type InstalledPlugin } from '../Config/pages/Plugin/installedPlugins'
const appWindow = getCurrentWebviewWindow()

type ServiceInstanceConfigMap = Record<string, Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const pluginListAtom = atom<Record<string, InstalledPlugin>>({})

let blurTimeout: ReturnType<typeof setTimeout> | null = null

const listenBlur = () => {
  return listen('neopot://blur', () => {
    if (appWindow.label === 'recognize') {
      if (blurTimeout) {
        clearTimeout(blurTimeout)
      }
      // Close the window after 50ms, because dragging a window on windows switches to blur and then immediately to focus.
      blurTimeout = setTimeout(async () => {
        await appWindow.close()
      }, 50)
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

export default function Recognize() {
  const { t } = useTranslation()
  const [, setPluginList] = useAtom(pluginListAtom)
  const [closeOnBlur] = useConfig('recognize_close_on_blur', false)
  const [pined, setPined] = useState(false)
  const [serviceInstanceList] = useConfig<string[]>('recognize_service_list', ['local_model'])
  const [pluginLoadError, setPluginLoadError] = useState<string | null>(null)
  const [serviceConfigError, setServiceConfigError] = useState<string | null>(null)
  const [serviceInstanceConfigMap, setServiceInstanceConfigMap] =
    useState<ServiceInstanceConfigMap>({})

  const loadPluginList = useCallback(async () => {
    try {
      const temp: Record<string, InstalledPlugin> = {}
      const plugins = (await loadInstalledPlugins('recognize')).filter((plugin) => plugin.enabled)
      for (const plugin of plugins) {
        temp[plugin.name] = plugin
      }
      setPluginLoadError(null)
      setPluginList({ ...temp })
    } catch (error) {
      logger.error('Failed to load recognize plugin list.', error)
      setPluginLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [setPluginList])
  const loadServiceInstanceConfigMap = useCallback(async () => {
    try {
      if (serviceInstanceList === null) {
        return
      }

      const config: ServiceInstanceConfigMap = {}
      for (const serviceInstanceKey of serviceInstanceList) {
        const value = await getStoreValue(serviceInstanceKey)
        config[serviceInstanceKey] = isRecord(value) ? value : {}
      }
      setServiceConfigError(null)
      setServiceInstanceConfigMap({ ...config })
    } catch (error) {
      logger.error('Failed to load recognize service config map.', error)
      setServiceConfigError(error instanceof Error ? error.message : String(error))
    }
  }, [serviceInstanceList])
  useEffect(() => {
    if (serviceInstanceList !== null) {
      loadServiceInstanceConfigMap()
    }
  }, [serviceInstanceList, loadServiceInstanceConfigMap])

  useEffect(() => {
    loadPluginList()
    const unlistenPromise = listen('reload_plugin_list', loadPluginList)
    return () => {
      unlistenPromise.then((unlisten) => {
        unlisten()
      })
    }
  }, [loadPluginList])
  useEffect(() => {
    if (closeOnBlur !== null && !closeOnBlur) {
      unlistenBlur()
    }
  }, [closeOnBlur])

  const hasInitError = pluginLoadError !== null || serviceConfigError !== null
  const isRecognizeConfigReady = serviceInstanceList !== null

  return (
    <div className={`flex h-screen flex-col bg-background ${LINUX_WINDOW_FRAME_CLASS}`}>
      <TopDragRegion />
      <div
        className={`${WINDOW_TOPBAR_HEIGHT_CLASS} flex ${
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
      </div>
      {hasInitError ? (
        <ErrorPanel
          className="m-4"
          title={t('errors.recognize_window_initialization_failed')}
          messageClassName="wrap-break-word text-sm"
        >
          {`${pluginLoadError ?? ''}${
            pluginLoadError && serviceConfigError ? '\n' : ''
          }${serviceConfigError ?? ''}`}
        </ErrorPanel>
      ) : isRecognizeConfigReady ? (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-2">
            <ImageArea />
            <TextArea serviceInstanceConfigMap={serviceInstanceConfigMap} />
          </div>
          <div className="h-12.5">
            <ControlArea
              serviceInstanceList={serviceInstanceList}
              serviceInstanceConfigMap={serviceInstanceConfigMap}
            />
          </div>
        </>
      ) : (
        <div className="m-4 rounded-medium border border-default-200 bg-content1 px-4 py-3 text-sm text-default-500">
          {t('status.loading_recognize_window')}
        </div>
      )}
    </div>
  )
}
