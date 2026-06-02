import { Card, Spacer, Button, useDisclosure } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Reorder } from 'framer-motion'

import SelectPluginModal from '../SelectPluginModal'
import { osType } from '@/renderer/lib/config/env'
import { useConfig, deleteKey, isSameConfigValue } from '../../../../../hooks'
import ServiceItem from './ServiceItem'
import ConfigModal from './ConfigModal'
import { useConfigSave } from '../../../hooks/useConfigSave'

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
  const { saveConfig } = useConfigSave()

  const deleteServiceInstance = async (instanceKey) => {
    const newList = ttsServiceInstanceList.filter((x) => x !== instanceKey)
    const saved = await saveConfig(
      'tts_service_list',
      ttsServiceInstanceList,
      setTtsServiceInstanceList,
      newList,
    )
    if (saved) {
      await deleteKey(instanceKey)
    }
  }
  const updateServiceInstanceList = async (instanceKey) => {
    if (ttsServiceInstanceList.includes(instanceKey)) {
      return
    } else {
      const newList = [...ttsServiceInstanceList, instanceKey]
      await saveConfig(
        'tts_service_list',
        ttsServiceInstanceList,
        setTtsServiceInstanceList,
        newList,
        {
          notify: false,
        },
      )
    }
  }
  const handleServiceReorder = (serviceInstanceList) => {
    if (isSameConfigValue(ttsServiceInstanceList, serviceInstanceList)) {
      return
    }

    void saveConfig(
      'tts_service_list',
      ttsServiceInstanceList,
      setTtsServiceInstanceList,
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
