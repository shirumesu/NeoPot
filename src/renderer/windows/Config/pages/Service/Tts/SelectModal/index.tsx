import * as builtinServices from '@/renderer/providers/tts'
import SharedSelectModal, { type SelectModalProps } from '../../SelectModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TtsSelectModalProps = Omit<SelectModalProps, 'serviceType' | 'builtinServices'>

export default function SelectModal(props: TtsSelectModalProps) {
  return (
    <SharedSelectModal {...props} serviceType={ServiceType.TTS} builtinServices={builtinServices} />
  )
}
