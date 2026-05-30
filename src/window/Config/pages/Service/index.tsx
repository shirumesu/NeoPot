// @ts-nocheck
import { listen } from '@/utils/electron_compat/event'
import { useTranslation } from 'react-i18next'
import { Tabs, Tab } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import Translate from './Translate'
import Recognize from './Recognize'
import Tts from './Tts'
import { loadEnabledServicePlugins } from '../Plugin/installedPlugins'
import { ServiceType } from '../../../../utils/service_instance'

let unlisten = null

export default function Service() {
  const [pluginList, setPluginList] = useState(null)
  const { t } = useTranslation()

  const loadPluginList = async () => {
    setPluginList(await loadEnabledServicePlugins())
  }

  useEffect(() => {
    loadPluginList()
    if (unlisten) {
      unlisten.then((f) => {
        f()
      })
    }
    unlisten = listen('reload_plugin_list', loadPluginList)
    return () => {
      if (unlisten) {
        unlisten.then((f) => {
          f()
        })
      }
    }
  }, [])
  return (
    pluginList !== null && (
      <Tabs className="flex justify-center max-h-[calc(100%-40px)] overflow-y-auto">
        <Tab key="translate" title={t(`config.service.translate`)}>
          <Translate pluginList={pluginList[ServiceType.TRANSLATE]} />
        </Tab>
        <Tab key="recognize" title={t(`config.service.recognize`)}>
          <Recognize pluginList={pluginList[ServiceType.RECOGNIZE]} />
        </Tab>
        <Tab key="tts" title={t(`config.service.tts`)}>
          <Tts pluginList={pluginList[ServiceType.TTS]} />
        </Tab>
      </Tabs>
    )
  )
}
