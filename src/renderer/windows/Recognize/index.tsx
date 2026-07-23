import { useCallback, useState, useEffect, useMemo } from 'react'
import { onAppEvent } from '@/renderer/lib/electron/events'
import { atom, useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'

import WindowControl from '../../components/WindowControl'
import ErrorPanel from '../../components/ErrorPanel'
import { osType } from '@/renderer/lib/config/env'
import {
  LINUX_WINDOW_FRAME_CLASS,
  TopDragRegion,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { PinButton, useCloseOnBlur } from '@/renderer/components/WindowPinning'
import { useConfig } from '../../hooks'
import ControlArea from './ControlArea'
import ImageArea from './ImageArea'
import TextArea from './TextArea'
import { logger } from '@/renderer/lib/logger'
import { loadInstalledPlugins, type InstalledPlugin } from '../Config/pages/Plugin/installedPlugins'
import {
  ServiceSourceType,
  isValidServiceInstanceKey,
  whetherAvailableService,
} from '@/renderer/lib/service/service_instance'
import * as builtinRecognizeServices from '@/renderer/providers/recognize'
import type { BuiltinServices } from '../Config/pages/Service/types'
import {
  loadServiceInstanceConfigMap,
  type ServiceInstanceConfigMap,
} from '@/renderer/lib/service/serviceConfig'
const builtinRecognizeServiceMap = builtinRecognizeServices as BuiltinServices

export const pluginListAtom = atom<Record<string, InstalledPlugin>>({})

export default function Recognize() {
  const { t } = useTranslation()
  const [pluginList, setPluginList] = useAtom(pluginListAtom)
  const [closeOnBlur] = useConfig('recognize_close_on_blur', false)
  const { isPinned, togglePinned } = useCloseOnBlur({
    enabled: closeOnBlur === true,
    delayMs: 50,
  })
  const [serviceInstanceList] = useConfig<string[]>('recognize_service_list', ['local_model'])
  const [pluginLoadError, setPluginLoadError] = useState<string | null>(null)
  const [serviceConfigError, setServiceConfigError] = useState<string | null>(null)
  const [serviceInstanceConfigMap, setServiceInstanceConfigMap] =
    useState<ServiceInstanceConfigMap>({})
  const availableRecognizeServices = useMemo(
    () => ({
      [ServiceSourceType.BUILDIN]: builtinRecognizeServiceMap,
      [ServiceSourceType.PLUGIN]: pluginList,
    }),
    [pluginList],
  )
  const validServiceInstanceList = useMemo(
    () =>
      Array.isArray(serviceInstanceList)
        ? serviceInstanceList.filter(
            (key) =>
              isValidServiceInstanceKey(key) &&
              whetherAvailableService(key, availableRecognizeServices),
          )
        : [],
    [availableRecognizeServices, serviceInstanceList],
  )

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
  const refreshServiceInstanceConfigMap = useCallback(async () => {
    try {
      const config = await loadServiceInstanceConfigMap(validServiceInstanceList)
      setServiceConfigError(null)
      setServiceInstanceConfigMap(config)
    } catch (error) {
      logger.error('Failed to load recognize service config map.', error)
      setServiceConfigError(error instanceof Error ? error.message : String(error))
    }
  }, [validServiceInstanceList])
  useEffect(() => {
    if (serviceInstanceList !== null) {
      void refreshServiceInstanceConfigMap()
    }
  }, [serviceInstanceList, refreshServiceInstanceConfigMap])

  useEffect(() => {
    loadPluginList()
    return onAppEvent('reload_plugin_list', loadPluginList)
  }, [loadPluginList])

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
        <PinButton isPinned={isPinned} onToggle={togglePinned} />
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
              serviceInstanceList={validServiceInstanceList}
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
