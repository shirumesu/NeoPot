import * as builtinServices from '@/renderer/providers/translate'
import SharedServiceItem, { type ServiceItemProps } from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TranslateServiceItemProps = Omit<
  ServiceItemProps,
  'serviceType' | 'builtinServices' | 'showEnableSwitch' | 'pluginLabelSeparator'
>

export default function ServiceItem(props: TranslateServiceItemProps) {
  return (
    <SharedServiceItem
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices}
      showEnableSwitch
      pluginLabelSeparator=""
    />
  )
}
