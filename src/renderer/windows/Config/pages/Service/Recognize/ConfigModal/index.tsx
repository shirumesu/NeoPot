import * as builtinServices from '@/renderer/providers/recognize'
import SharedConfigModal, { type ConfigModalProps } from '../../ConfigModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type RecognizeConfigModalProps = Omit<ConfigModalProps, 'serviceType' | 'builtinServices'>

export default function ConfigModal(props: RecognizeConfigModalProps) {
  return (
    <SharedConfigModal
      {...props}
      serviceType={ServiceType.RECOGNIZE}
      builtinServices={builtinServices}
    />
  )
}
