import * as builtinServices from '@/renderer/providers/recognize'
import SharedServiceItem from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function ServiceItem(props: any) {
  return (
    <SharedServiceItem
      {...props}
      serviceType={ServiceType.RECOGNIZE}
      builtinServices={builtinServices as any}
    />
  )
}
