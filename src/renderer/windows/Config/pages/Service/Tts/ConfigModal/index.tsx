import * as builtinServices from '@/renderer/providers/tts'
import SharedConfigModal, { type ConfigModalProps } from '../../ConfigModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TtsConfigModalProps = Omit<
  ConfigModalProps,
  'serviceType' | 'builtinServices' | 'guardEmptyServiceKey'
>

export default function ConfigModal(props: TtsConfigModalProps) {
  return (
    <SharedConfigModal
      {...props}
      serviceType={ServiceType.TTS}
      builtinServices={builtinServices}
      guardEmptyServiceKey
    />
  )
}
