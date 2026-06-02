import { Card, Spacer, Button, useDisclosure } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Reorder } from 'framer-motion'

import { useToastStyle } from '../../../../../hooks'
import SelectPluginModal from '../SelectPluginModal'
import { osType } from '@/renderer/lib/config/env'
import { useConfig, deleteKey, isSameConfigValue } from '../../../../../hooks'
import ServiceItem from './ServiceItem'
import SelectModal from './SelectModal'
import ConfigModal from './ConfigModal'
import { useConfigSave } from '../../../hooks/useConfigSave'

const ReorderGroup = Reorder.Group as any

export default function Recognize(props) {
  const { pluginList } = props
  const {
    isOpen: isSelectPluginOpen,
    onOpen: onSelectPluginOpen,
    onOpenChange: onSelectPluginOpenChange,
  } = useDisclosure()
  const {
    isOpen: isSelectOpen,
    onOpen: onSelectOpen,
    onOpenChange: onSelectOpenChange,
  } = useDisclosure()
  const {
    isOpen: isConfigOpen,
    onOpen: onConfigOpen,
    onOpenChange: onConfigOpenChange,
  } = useDisclosure()
  const [currentConfigKey, setCurrentConfigKey] = useState('local_model')
  // now it's service instance list
  const [recognizeServiceInstanceList, setRecognizeServiceInstanceList] = useConfig(
    'recognize_service_list',
    ['local_model'],
  )

  const { t } = useTranslation()
  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  const deleteServiceInstance = async (instanceKey) => {
    if (recognizeServiceInstanceList.length === 1) {
      toast.error(t('config.service.least'), { style: toastStyle })
      return
    } else {
      const newList = recognizeServiceInstanceList.filter((x) => x !== instanceKey)
      const saved = await saveConfig(
        'recognize_service_list',
        recognizeServiceInstanceList,
        setRecognizeServiceInstanceList,
        newList,
      )
      if (saved) {
        await deleteKey(instanceKey)
      }
    }
  }
  const updateServiceInstanceList = async (instanceKey) => {
    if (recognizeServiceInstanceList.includes(instanceKey)) {
      return
    } else {
      const newList = [...recognizeServiceInstanceList, instanceKey]
      await saveConfig(
        'recognize_service_list',
        recognizeServiceInstanceList,
        setRecognizeServiceInstanceList,
        newList,
        { notify: false },
      )
    }
  }
  const handleServiceReorder = (serviceInstanceList) => {
    if (isSameConfigValue(recognizeServiceInstanceList, serviceInstanceList)) {
      return
    }

    void saveConfig(
      'recognize_service_list',
      recognizeServiceInstanceList,
      setRecognizeServiceInstanceList,
      serviceInstanceList,
      { notify: false },
    )
  }

  return (
    <>
      <Card
        className={`${
          osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
        } overflow-y-auto p-5 flex justify-between`}
      >
        {recognizeServiceInstanceList !== null && (
          <ReorderGroup
            axis="y"
            values={recognizeServiceInstanceList}
            onReorder={handleServiceReorder}
            className="overflow-y-auto h-full"
          >
            {recognizeServiceInstanceList.map((x) => {
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
          <Button fullWidth onPress={onSelectOpen}>
            {t('config.service.add_builtin_service')}
          </Button>
          <Spacer x={2} />
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
      <SelectModal
        isOpen={isSelectOpen}
        onOpenChange={onSelectOpenChange}
        setCurrentConfigKey={setCurrentConfigKey}
        onConfigOpen={onConfigOpen}
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
