import * as builtinServices from '@/renderer/providers/tts'
import SharedSelectModal from '../../SelectModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function SelectModal(props: any) {
  return (
    <SharedSelectModal
      {...props}
      serviceType={ServiceType.TTS}
      builtinServices={builtinServices as any}
    />
  )
}
