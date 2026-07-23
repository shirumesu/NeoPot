import { onAppEvent } from '@/renderer/lib/electron/events'
import { useTranslation } from 'react-i18next'
import { Tabs, Tab } from '@heroui/react'
import { useEffect, useState } from 'react'
import Translate from './Translate'
import Recognize from './Recognize'
import Tts from './Tts'
import { EnabledServicePluginList, loadEnabledServicePlugins } from '../Plugin/installedPlugins'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function Service() {
  const [pluginList, setPluginList] = useState<EnabledServicePluginList | null>(null)
  const { t } = useTranslation()

  const loadPluginList = async () => {
    setPluginList(await loadEnabledServicePlugins())
  }

  useEffect(() => {
    void loadPluginList()
    return onAppEvent('reload_plugin_list', loadPluginList)
  }, [])
  return (
    pluginList !== null && (
      <Tabs
        className="w-full"
        classNames={{
          base: 'w-full',
          tabList: 'mx-auto grid w-[18rem] max-w-full grid-cols-3 gap-1',
          tab: 'h-9 min-w-0 px-0',
          tabContent: 'w-full text-center',
          panel: 'w-full px-0 pt-3',
        }}
      >
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
