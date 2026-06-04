import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import React, { useCallback, useState, useEffect } from 'react'
import { listen } from '@/renderer/lib/electron/compat/event'
import { Button } from '@heroui/react'
import { BsPinFill } from 'react-icons/bs'
import { atom, useAtom } from 'jotai'

import WindowControl from '../../components/WindowControl'
import { getStoreValue } from '@/renderer/lib/config/store'
import { osType } from '@/renderer/lib/config/env'
import { useConfig } from '../../hooks'
import ControlArea from './ControlArea'
import ImageArea from './ImageArea'
import TextArea from './TextArea'
import { logger } from '@/renderer/lib/logger'
import { loadInstalledPlugins } from '../Config/pages/Plugin/installedPlugins'
const appWindow = getCurrentWebviewWindow()

export const pluginListAtom = atom<Record<string, any>>({})

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
  const [, setPluginList] = useAtom(pluginListAtom)
  const [closeOnBlur] = useConfig('recognize_close_on_blur', false)
  const [pined, setPined] = useState(false)
  const [serviceInstanceList] = useConfig<string[]>('recognize_service_list', ['local_model'])
  const [pluginLoadError, setPluginLoadError] = useState<string | null>(null)
  const [serviceConfigError, setServiceConfigError] = useState<string | null>(null)
  const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState<Record<string, any>>({})

  const loadPluginList = useCallback(async () => {
    try {
      const temp: Record<string, any> = {}
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

      const config: Record<string, any> = {}
      for (const serviceInstanceKey of serviceInstanceList) {
        config[serviceInstanceKey] = (await getStoreValue(serviceInstanceKey)) ?? {}
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
    <div
      className={`bg-background h-screen ${
        osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
      }`}
    >
      <div data-tauri-drag-region="true" className="fixed top-1.25 left-1.25 right-1.25 h-7.5" />
      <div className={`h-8.75 flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          disableAnimation
          className="my-auto mx-1.25 bg-transparent"
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
        {osType !== 'Darwin' && <WindowControl />}
      </div>
      {hasInitError ? (
        <div className="m-4 rounded-medium border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <div className="mb-2 font-semibold">Recognize window initialization failed</div>
          <pre className="whitespace-pre-wrap wrap-break-word">{`${pluginLoadError ?? ''}${
            pluginLoadError && serviceConfigError ? '\n' : ''
          }${serviceConfigError ?? ''}`}</pre>
        </div>
      ) : isRecognizeConfigReady ? (
        <>
          <div
            className={`${
              osType === 'Linux' ? 'h-[calc(100vh-87px)]' : 'h-[calc(100vh-85px)]'
            } grid grid-cols-2`}
          >
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
          Loading recognize window...
        </div>
      )}
    </div>
  )
}
