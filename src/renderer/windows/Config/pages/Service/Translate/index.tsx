import { Card, Button, useDisclosure } from '@heroui/react'
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

export default function Translate(props: any) {
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
  const [currentConfigKey, setCurrentConfigKey] = useState('deepl')
  // now it's service instance list
  const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig<string[]>(
    'translate_service_list',
    ['deepl', 'google'],
  )

  const { t } = useTranslation()
  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  const deleteServiceInstance = async (instanceKey: string) => {
    if (translateServiceInstanceList === null) {
      return
    }
    if (translateServiceInstanceList.length === 1) {
      toast.error(t('config.service.least'), { style: toastStyle })
      return
    } else {
      const newList = translateServiceInstanceList.filter((x) => x !== instanceKey)
      const saved = await saveConfig(
        'translate_service_list',
        translateServiceInstanceList,
        setTranslateServiceInstanceList,
        newList,
      )
      if (saved) {
        await deleteKey(instanceKey)
      }
    }
  }
  const updateServiceInstanceList = async (instanceKey: string) => {
    if (translateServiceInstanceList === null) {
      return
    }
    if (translateServiceInstanceList.includes(instanceKey)) {
      return
    } else {
      const newList = [...translateServiceInstanceList, instanceKey]
      await saveConfig(
        'translate_service_list',
        translateServiceInstanceList,
        setTranslateServiceInstanceList,
        newList,
        { notify: false },
      )
    }
  }
  const handleServiceReorder = (serviceInstanceList: string[]) => {
    if (translateServiceInstanceList === null) {
      return
    }
    if (isSameConfigValue(translateServiceInstanceList, serviceInstanceList)) {
      return
    }

    void saveConfig(
      'translate_service_list',
      translateServiceInstanceList,
      setTranslateServiceInstanceList,
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
        {translateServiceInstanceList !== null && (
          <ReorderGroup
            axis="y"
            values={translateServiceInstanceList}
            onReorder={handleServiceReorder}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto"
          >
            {translateServiceInstanceList.map((x) => {
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
        pluginList={pluginList}
        isOpen={isConfigOpen}
        onOpenChange={onConfigOpenChange}
        updateServiceInstanceList={updateServiceInstanceList}
      />
    </>
  )
}
