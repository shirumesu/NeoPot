import * as builtinServices from '@/renderer/providers/tts'
import SharedServiceItem, { type ServiceItemProps } from '../../ServiceItem'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TtsServiceItemProps = Omit<ServiceItemProps, 'serviceType' | 'builtinServices'>

export default function ServiceItem(props: TtsServiceItemProps) {
  return (
    <SharedServiceItem {...props} serviceType={ServiceType.TTS} builtinServices={builtinServices} />
  )
}
