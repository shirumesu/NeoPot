import * as builtinServices from '@/renderer/providers/translate'
import SharedConfigModal from '../../ConfigModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function ConfigModal(props: any) {
  return (
    <SharedConfigModal
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices as any}
    />
  )
}
