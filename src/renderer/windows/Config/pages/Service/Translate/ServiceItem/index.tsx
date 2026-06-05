import * as builtinServices from '@/renderer/providers/translate'
import SharedServiceItem from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function ServiceItem(props: any) {
  return (
    <SharedServiceItem
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices as any}
      showEnableSwitch
      pluginLabelSeparator=""
    />
  )
}
