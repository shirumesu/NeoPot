import * as builtinServices from '@/renderer/providers/translate'
import ServiceListPage from '../ServiceListPage'
import type { ServicePluginMap } from '../types'
import { ServiceType } from '@/renderer/lib/service/service_instance'

const TRANSLATE_SERVICE_LIST_KEY = 'translate_service_list'
const DEFAULT_TRANSLATE_SERVICE_LIST = ['deepl', 'google']

interface TranslateProps {
  pluginList: ServicePluginMap
}

export default function Translate({ pluginList }: TranslateProps) {
  return (
    <ServiceListPage
      builtinServices={builtinServices}
      configKey={TRANSLATE_SERVICE_LIST_KEY}
      defaultList={DEFAULT_TRANSLATE_SERVICE_LIST}
      initialConfigKey="deepl"
      pluginList={pluginList}
      serviceType={ServiceType.TRANSLATE}
      pluginLabelSeparator=""
      protectLastService
      showEnableSwitch
    />
  )
}
