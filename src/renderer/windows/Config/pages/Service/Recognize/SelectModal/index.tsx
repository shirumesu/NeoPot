import * as builtinServices from '@/renderer/providers/recognize'
import SharedSelectModal, { type SelectModalProps } from '../../SelectModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type RecognizeSelectModalProps = Omit<SelectModalProps, 'serviceType' | 'builtinServices'>

export default function SelectModal(props: RecognizeSelectModalProps) {
  return (
    <SharedSelectModal
      {...props}
      serviceType={ServiceType.RECOGNIZE}
      builtinServices={builtinServices}
    />
  )
}
