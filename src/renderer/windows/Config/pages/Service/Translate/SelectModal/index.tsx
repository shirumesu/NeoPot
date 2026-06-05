import * as builtinServices from '@/renderer/providers/translate'
import SharedSelectModal, { type SelectModalProps } from '../../SelectModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TranslateSelectModalProps = Omit<SelectModalProps, 'serviceType' | 'builtinServices'>

export default function SelectModal(props: TranslateSelectModalProps) {
  return (
    <SharedSelectModal
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices}
    />
  )
}
