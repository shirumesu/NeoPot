import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React from 'react'

import { createServiceInstanceKey } from '@/renderer/lib/service/service_instance'
import type { InstalledPlugin } from '../../Plugin/installedPlugins'

export default function SelectPluginModal(props: any) {
  const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen, pluginList } = props
  const { t } = useTranslation()
  const pluginEntries = Object.entries(pluginList as Record<string, InstalledPlugin>)

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{t('config.service.add_installed_plugin_service')}</ModalHeader>
            <ModalBody>
              {pluginEntries.length === 0 && (
                <div className="rounded-small border border-default-200 bg-content2 px-3 py-4 text-center text-sm text-default-500">
                  {t('config.service.no_installed_plugin_service')}
                </div>
              )}

              {pluginEntries.map(([x, plugin]) => {
                return (
                  <div className="flex justify-between" key={x}>
                    <Button
                      fullWidth
                      className="mr-2"
                      onPress={() => {
                        setCurrentConfigKey(createServiceInstanceKey(x))
                        onConfigOpen()
                      }}
                      startContent={<img src={plugin.icon} className="h-6 w-6 my-auto" />}
                    >
                      <div className="w-full">{plugin.display}</div>
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
