import { Card, Button, useDisclosure } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Reorder } from 'framer-motion'

import SelectPluginModal from '../SelectPluginModal'
import { osType } from '@/renderer/lib/config/env'
import ServiceItem from './ServiceItem'
import SelectModal from './SelectModal'
import ConfigModal from './ConfigModal'
import { useServiceInstanceList } from '../useServiceInstanceList'
import type { ServicePluginMap } from '../types'

const TTS_SERVICE_LIST_KEY = 'tts_service_list'
const DEFAULT_TTS_SERVICE_LIST: string[] = []

interface TtsProps {
  pluginList: ServicePluginMap
}

export default function Tts({ pluginList }: TtsProps) {
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
  const {
    serviceInstanceList: ttsServiceInstanceList,
    deleteServiceInstance,
    updateServiceInstanceList,
    handleServiceReorder,
  } = useServiceInstanceList({
    configKey: TTS_SERVICE_LIST_KEY,
    defaultList: DEFAULT_TTS_SERVICE_LIST,
  })

  const { t } = useTranslation()

  return (
    <>
      <Card
        className={`${
          osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
        } w-full overflow-hidden p-5 flex flex-col`}
      >
        {ttsServiceInstanceList !== null && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Reorder.Group
              axis="y"
              values={ttsServiceInstanceList}
              onReorder={handleServiceReorder}
            >
              {ttsServiceInstanceList.map((x) => {
                return (
                  <Reorder.Item key={x} value={x}>
                    <div className="mb-2">
                      <ServiceItem
                        serviceInstanceKey={x}
                        pluginList={pluginList}
                        deleteServiceInstance={deleteServiceInstance}
                        setCurrentConfigKey={setCurrentConfigKey}
                        onConfigOpen={onConfigOpen}
                      />
                    </div>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          </div>
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
