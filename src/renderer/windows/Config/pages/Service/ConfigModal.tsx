import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spacer,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { PluginConfig } from './PluginConfig'
import {
  ServiceSourceType,
  ServiceType,
  getServiceName,
  getServiceSouceType,
  whetherPluginService,
} from '@/renderer/lib/service/service_instance'

interface ConfigModalProps {
  serviceInstanceKey: string
  pluginList: Record<string, { icon: string; display: string }>
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  updateServiceInstanceList: (key: string) => void
  serviceType: ServiceType
  builtinServices: Record<string, any>
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

  return (guardEmptyServiceKey && serviceInstanceKey === '') ||
    (pluginServiceFlag && !(serviceName in pluginList)) ||
    (!pluginServiceFlag && (!builtinService || typeof ConfigComponent !== 'function')) ? (
    <></>
  ) : (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[75vh]">
        {(onClose) => (
          <>
            <ModalHeader>
              {serviceSourceType === ServiceSourceType.BUILDIN && (
                <>
                  <img
                    src={builtinService.info.icon}
                    className="h-6 w-6 my-auto"
                    draggable={false}
                  />
                  <Spacer x={2} />
                  {t(`services.${serviceType}.${serviceName}.title`)}
                </>
              )}
              {pluginServiceFlag && (
                <>
                  <img
                    src={pluginList[serviceName].icon}
                    className="h-6 w-6 my-auto"
                    draggable={false}
                  />

                  <Spacer x={2} />
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
