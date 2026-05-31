import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React from 'react'

import { createServiceInstanceKey } from '@/renderer/lib/service/service_instance'

export default function SelectPluginModal(props) {
  const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen, pluginList } = props
  const { t } = useTranslation()

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{t('config.service.add_installed_plugin_service')}</ModalHeader>
            <ModalBody>
              {Object.keys(pluginList).length === 0 && (
                <Button fullWidth variant="flat" isDisabled>
                  <div className="w-full">Coming soon</div>
                </Button>
              )}

              {Object.keys(pluginList).map((x) => {
                return (
                  <div className="flex justify-between" key={x}>
                    <Button
                      fullWidth
                      className="mr-2"
                      onPress={() => {
                        setCurrentConfigKey(createServiceInstanceKey(x))
                        onConfigOpen()
                      }}
                      startContent={<img src={pluginList[x].icon} className="h-6 w-6 my-auto" />}
                    >
                      <div className="w-full">{pluginList[x].display}</div>
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
