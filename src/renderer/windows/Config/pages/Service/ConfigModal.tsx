import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { PluginConfig } from './PluginConfig'
import {
  ServiceSourceType,
  ServiceType,
  getServiceName,
  getServiceSouceType,
  whetherPluginService,
} from '@/renderer/lib/service/service_instance'
import { SERVICE_ICON_CLASS } from './types'
import type { BuiltinServices, ServicePluginMap } from './types'

export interface ConfigModalProps {
  serviceInstanceKey: string
  pluginList: ServicePluginMap
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  updateServiceInstanceList: (key: string) => void | Promise<void>
  serviceType: ServiceType
  builtinServices: BuiltinServices
  guardEmptyServiceKey?: boolean
}

export default function ConfigModal(props: ConfigModalProps) {
  const {
    serviceInstanceKey,
    pluginList,
    isOpen,
    onOpenChange,
    updateServiceInstanceList,
    serviceType,
    builtinServices,
    guardEmptyServiceKey = false,
  } = props

  const serviceSourceType = getServiceSouceType(serviceInstanceKey)
  const pluginServiceFlag = whetherPluginService(serviceInstanceKey)
  const serviceName = getServiceName(serviceInstanceKey)

  const { t } = useTranslation()
  const builtinService = builtinServices[serviceName]
  const ConfigComponent = pluginServiceFlag ? PluginConfig : builtinService?.Config

  if (
    (guardEmptyServiceKey && serviceInstanceKey === '') ||
    (pluginServiceFlag && !(serviceName in pluginList)) ||
    !ConfigComponent ||
    (!pluginServiceFlag && !builtinService)
  ) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[75vh]">
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              {serviceSourceType === ServiceSourceType.BUILDIN && (
                <>
                  <img
                    src={builtinService.info.icon}
                    className={SERVICE_ICON_CLASS}
                    draggable={false}
                  />
                  {t(`services.${serviceType}.${serviceName}.title`)}
                </>
              )}
              {pluginServiceFlag && (
                <>
                  <img
                    src={pluginList[serviceName].icon}
                    className={SERVICE_ICON_CLASS}
                    draggable={false}
                  />

                  {`${pluginList[serviceName].display} [${t('common.plugin')}]`}
                </>
              )}
            </ModalHeader>
            <ModalBody>
              <ConfigComponent
                name={serviceName}
                instanceKey={serviceInstanceKey}
                pluginType={serviceType}
                pluginList={pluginList}
                updateServiceList={updateServiceInstanceList}
                onClose={onClose}
              />
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
