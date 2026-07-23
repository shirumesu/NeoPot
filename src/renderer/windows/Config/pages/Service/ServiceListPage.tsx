import { Button, Card, useDisclosure } from '@heroui/react'
import { Reorder } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import ConfigModal from './ConfigModal'
import SelectModal from './SelectModal'
import SelectPluginModal from './SelectPluginModal'
import ServiceItem from './ServiceItem'
import type { BuiltinServices, ServicePluginMap } from './types'
import { useServiceInstanceList } from './useServiceInstanceList'
import { osType } from '@/renderer/lib/config/env'
import type { ServiceType } from '@/renderer/lib/service/service_instance'

interface ServiceListPageProps {
  builtinServices: BuiltinServices
  configKey: string
  defaultList: string[]
  initialConfigKey: string
  pluginList: ServicePluginMap
  serviceType: ServiceType
  guardEmptyServiceKey?: boolean
  pluginLabelSeparator?: string
  protectLastService?: boolean
  showEnableSwitch?: boolean
}

export default function ServiceListPage(props: ServiceListPageProps) {
  const {
    builtinServices,
    configKey,
    defaultList,
    initialConfigKey,
    pluginList,
    serviceType,
    guardEmptyServiceKey,
    pluginLabelSeparator,
    protectLastService,
    showEnableSwitch,
  } = props
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
  const [currentConfigKey, setCurrentConfigKey] = useState(initialConfigKey)
  const {
    serviceInstanceList,
    deleteServiceInstance,
    updateServiceInstanceList,
    handleServiceReorder,
  } = useServiceInstanceList({
    configKey,
    defaultList,
    protectLastService,
  })
  const { t } = useTranslation()

  return (
    <>
      <Card
        className={`${
          osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
        } w-full overflow-hidden p-5 flex flex-col`}
      >
        {serviceInstanceList !== null && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Reorder.Group axis="y" values={serviceInstanceList} onReorder={handleServiceReorder}>
              {serviceInstanceList.map((serviceInstanceKey) => (
                <Reorder.Item key={serviceInstanceKey} value={serviceInstanceKey}>
                  <div className="mb-2">
                    <ServiceItem
                      serviceInstanceKey={serviceInstanceKey}
                      pluginList={pluginList}
                      deleteServiceInstance={deleteServiceInstance}
                      setCurrentConfigKey={setCurrentConfigKey}
                      onConfigOpen={onConfigOpen}
                      serviceType={serviceType}
                      builtinServices={builtinServices}
                      pluginLabelSeparator={pluginLabelSeparator}
                      showEnableSwitch={showEnableSwitch}
                    />
                  </div>
                </Reorder.Item>
              ))}
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
        serviceType={serviceType}
        builtinServices={builtinServices}
      />
      <ConfigModal
        serviceInstanceKey={currentConfigKey}
        pluginList={pluginList}
        isOpen={isConfigOpen}
        onOpenChange={onConfigOpenChange}
        updateServiceInstanceList={updateServiceInstanceList}
        serviceType={serviceType}
        builtinServices={builtinServices}
        guardEmptyServiceKey={guardEmptyServiceKey}
      />
    </>
  )
}
