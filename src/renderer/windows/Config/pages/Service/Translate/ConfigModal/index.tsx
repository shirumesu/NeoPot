import * as builtinServices from '@/renderer/providers/translate'
import SharedConfigModal, { type ConfigModalProps } from '../../ConfigModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

type TranslateConfigModalProps = Omit<ConfigModalProps, 'serviceType' | 'builtinServices'>

export default function ConfigModal(props: TranslateConfigModalProps) {
  return (
    <SharedConfigModal
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices}
    />
  )
}
