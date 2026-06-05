import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { ServiceType, createServiceInstanceKey } from '@/renderer/lib/service/service_instance'

interface SelectModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setCurrentConfigKey: (key: string) => void
  onConfigOpen: () => void
  serviceType: ServiceType
  builtinServices: Record<string, any>
}

export default function SelectModal(props: SelectModalProps) {
  const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen, serviceType, builtinServices } =
    props
  const { t } = useTranslation()

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{t('config.service.add_service')}</ModalHeader>
            <ModalBody>
              {Object.keys(builtinServices).map((x) => {
                return (
                  <div key={x}>
                    <Button
                      fullWidth
                      onPress={() => {
                        setCurrentConfigKey(createServiceInstanceKey(x))
                        onConfigOpen()
                      }}
                      startContent={
                        <img src={builtinServices[x].info.icon} className="h-6 w-6 my-auto" />
                      }
                    >
                      <div className="w-full">
                        {t(`services.${serviceType}.${builtinServices[x].info.name}.title`)}
                      </div>
                    </Button>
                  </div>
                )
              })}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                {t('common.cancel')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
