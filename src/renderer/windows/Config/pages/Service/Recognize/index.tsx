import * as builtinServices from '@/renderer/providers/recognize'
import ServiceListPage from '../ServiceListPage'
import type { ServicePluginMap } from '../types'
import { ServiceType } from '@/renderer/lib/service/service_instance'

const RECOGNIZE_SERVICE_LIST_KEY = 'recognize_service_list'
const DEFAULT_RECOGNIZE_SERVICE_LIST = ['local_model']

interface RecognizeProps {
  pluginList: ServicePluginMap
}

export default function Recognize({ pluginList }: RecognizeProps) {
  return (
    <ServiceListPage
      builtinServices={builtinServices}
      configKey={RECOGNIZE_SERVICE_LIST_KEY}
      defaultList={DEFAULT_RECOGNIZE_SERVICE_LIST}
      initialConfigKey="local_model"
      pluginList={pluginList}
      serviceType={ServiceType.RECOGNIZE}
      protectLastService
    />
  )
}
