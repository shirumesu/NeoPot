import * as builtinServices from '@/renderer/providers/translate'
import SharedSelectModal from '../../SelectModal'
import { ServiceType } from '@/renderer/lib/service/service_instance'

export default function SelectModal(props: any) {
  return (
    <SharedSelectModal
      {...props}
      serviceType={ServiceType.TRANSLATE}
      builtinServices={builtinServices as any}
    />
  )
}
