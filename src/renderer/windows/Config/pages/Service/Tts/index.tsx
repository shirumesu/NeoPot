import { Card, Button, useDisclosure } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Reorder } from 'framer-motion'

import SelectPluginModal from '../SelectPluginModal'
import { osType } from '@/renderer/lib/config/env'
import { useConfig, deleteKey, isSameConfigValue } from '../../../../../hooks'
import ServiceItem from './ServiceItem'
import SelectModal from './SelectModal'
import ConfigModal from './ConfigModal'
import { useConfigSave } from '../../../hooks/useConfigSave'

const ReorderGroup = Reorder.Group as any

export default function Tts(props: any) {
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
  const [currentConfigKey, setCurrentConfigKey] = useState('')
  // now it's service instance list
  const [ttsServiceInstanceList, setTtsServiceInstanceList] = useConfig<string[]>(
    'tts_service_list',
    [],
  )

  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  const deleteServiceInstance = async (instanceKey: string) => {
    if (ttsServiceInstanceList === null) {
      return
    }
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
  const updateServiceInstanceList = async (instanceKey: string) => {
    if (ttsServiceInstanceList === null) {
      return
    }
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
  const handleServiceReorder = (serviceInstanceList: string[]) => {
    if (ttsServiceInstanceList === null) {
      return
    }
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
        } w-full overflow-hidden p-5 flex flex-col`}
      >
        {ttsServiceInstanceList !== null && (
          <ReorderGroup
            axis="y"
            values={ttsServiceInstanceList}
            onReorder={handleServiceReorder}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto"
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
                </Reorder.Item>
              )
            })}
          </ReorderGroup>
        )}
        <div className="flex shrink-0 gap-2 pt-2">
          <Button fullWidth onPress={onSelectOpen}>
            {t('config.service.add_builtin_service')}
          </Button>
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
