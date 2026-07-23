import * as builtinServices from '@/renderer/providers/tts'
import ServiceListPage from '../ServiceListPage'
import type { ServicePluginMap } from '../types'
import { ServiceType } from '@/renderer/lib/service/service_instance'

const TTS_SERVICE_LIST_KEY = 'tts_service_list'
const DEFAULT_TTS_SERVICE_LIST = ['lingva']

interface TtsProps {
  pluginList: ServicePluginMap
}

export default function Tts({ pluginList }: TtsProps) {
  return (
    <ServiceListPage
      builtinServices={builtinServices}
      configKey={TTS_SERVICE_LIST_KEY}
      defaultList={DEFAULT_TTS_SERVICE_LIST}
      initialConfigKey="lingva"
      pluginList={pluginList}
      serviceType={ServiceType.TTS}
      guardEmptyServiceKey
    />
  )
}
