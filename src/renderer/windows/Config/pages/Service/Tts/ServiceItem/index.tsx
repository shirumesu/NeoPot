import * as builtinServices from '@/renderer/providers/tts'
import SharedServiceItem from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function ServiceItem(props: any) {
  return (
    <SharedServiceItem
      {...props}
      serviceType={ServiceType.TTS}
      builtinServices={builtinServices as any}
    />
  )
}
