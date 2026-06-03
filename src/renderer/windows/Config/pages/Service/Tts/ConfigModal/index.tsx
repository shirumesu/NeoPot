import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spacer,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React from 'react'

import {
  ServiceSourceType,
  getServiceName,
  getServiceSouceType,
  whetherPluginService,
} from '@/renderer/lib/service/service_instance'
import * as builtinServices from '@/renderer/providers/tts'
import { PluginConfig } from '../../PluginConfig'

export default function ConfigModal(props: any) {
  const { serviceInstanceKey, pluginList, isOpen, onOpenChange, updateServiceInstanceList } = props

  const serviceSourceType = getServiceSouceType(serviceInstanceKey)
  const pluginServiceFlag = whetherPluginService(serviceInstanceKey)
  const serviceName = getServiceName(serviceInstanceKey)
  const { t } = useTranslation()
  const builtinServiceMap = builtinServices as Record<string, any>
  const builtinService = builtinServiceMap[serviceName]
  const ConfigComponent = pluginServiceFlag ? PluginConfig : builtinService?.Config

  return serviceInstanceKey === '' ||
    (pluginServiceFlag && !(serviceName in pluginList)) ||
    (!pluginServiceFlag && !builtinService) ? (
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
                  {t(`services.tts.${serviceName}.title`)}
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
                pluginType="tts"
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
