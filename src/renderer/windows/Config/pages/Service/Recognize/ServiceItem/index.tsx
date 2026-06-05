import * as builtinServices from '@/renderer/providers/recognize'
import SharedServiceItem, { type ServiceItemProps } from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type RecognizeServiceItemProps = Omit<ServiceItemProps, 'serviceType' | 'builtinServices'>

export default function ServiceItem(props: RecognizeServiceItemProps) {
  return (
    <SharedServiceItem
      {...props}
      serviceType={ServiceType.RECOGNIZE}
      builtinServices={builtinServices}
    />
  )
}
