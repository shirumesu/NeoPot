import { Card, Spacer, Button, useDisclosure } from '@heroui/react'
import { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Reorder } from 'framer-motion'

import SelectPluginModal from '../SelectPluginModal'
import { osType } from '@/renderer/lib/config/env'
import { useConfig, deleteKey, isSameConfigValue } from '../../../../../hooks'
import ServiceItem from './ServiceItem'
import ConfigModal from './ConfigModal'

const ReorderGroup = Reorder.Group as any

export default function Tts(props) {
  const { pluginList } = props
  const {
    isOpen: isSelectPluginOpen,
    onOpen: onSelectPluginOpen,
    onOpenChange: onSelectPluginOpenChange,
  } = useDisclosure()
  const {
    isOpen: isConfigOpen,
    onOpen: onConfigOpen,
    onOpenChange: onConfigOpenChange,
  } = useDisclosure()
  const [currentConfigKey, setCurrentConfigKey] = useState('')
  // now it's service instance list
  const [ttsServiceInstanceList, setTtsServiceInstanceList] = useConfig('tts_service_list', [])

  const { t } = useTranslation()

  const deleteServiceInstance = (instanceKey) => {
    setTtsServiceInstanceList(ttsServiceInstanceList.filter((x) => x !== instanceKey))
    deleteKey(instanceKey)
  }
  const updateServiceInstanceList = (instanceKey) => {
    if (ttsServiceInstanceList.includes(instanceKey)) {
      return
    } else {
      const newList = [...ttsServiceInstanceList, instanceKey]
      setTtsServiceInstanceList(newList)
    }
  }
  const handleServiceReorder = (serviceInstanceList) => {
    if (isSameConfigValue(ttsServiceInstanceList, serviceInstanceList)) {
      return
    }

    setTtsServiceInstanceList(serviceInstanceList)
  }

  return (
    <>
      <Toaster />
      <Card
        className={`${
          osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
        } overflow-y-auto p-5 flex justify-between`}
      >
        {ttsServiceInstanceList !== null && (
          <ReorderGroup
            axis="y"
            values={ttsServiceInstanceList}
            onReorder={handleServiceReorder}
            className="overflow-y-auto h-full"
          >
            {ttsServiceInstanceList.map((x) => {
              return (
                <Reorder.Item key={x} value={x}>
                  <ServiceItem
                    serviceInstanceKey={x}
                    pluginList={pluginList}
                    deleteServiceInstance={deleteServiceInstance}
                    setCurrentConfigKey={setCurrentConfigKey}
                    onConfigOpen={onConfigOpen}
                  />
                  <Spacer y={2} />
                </Reorder.Item>
              )
            })}
          </ReorderGroup>
        )}
        <Spacer y={2} />
        <div className="flex">
          <Button fullWidth onPress={onSelectPluginOpen}>
            {t('config.service.add_installed_plugin_service')}
          </Button>
        </div>
      </Card>
      <SelectPluginModal
        isOpen={isSelectPluginOpen}
        onOpenChange={onSelectPluginOpenChange}
        setCurrentConfigKey={setCurrentConfigKey}
        onConfigOpen={onConfigOpen}
        pluginList={pluginList}
      />
      <ConfigModal
        serviceInstanceKey={currentConfigKey}
        isOpen={isConfigOpen}
        pluginList={pluginList}
        onOpenChange={onConfigOpenChange}
        updateServiceInstanceList={updateServiceInstanceList}
      />
    </>
  )
}
