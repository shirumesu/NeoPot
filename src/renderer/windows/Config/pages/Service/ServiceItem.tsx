import { Button, Switch } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { BiSolidEdit } from 'react-icons/bi'
import { MdDeleteOutline } from 'react-icons/md'

import { useConfig } from '../../../../hooks'
import { useConfigSave } from '../../hooks/useConfigSave'
import {
  INSTANCE_NAME_CONFIG_KEY,
  ServiceSourceType,
  ServiceType,
  getDisplayInstanceName,
  getServiceName,
  getServiceSouceType,
} from '@/renderer/lib/service/service_instance'
import { SERVICE_ICON_CLASS } from './types'
import type { BuiltinServices, ServicePluginMap } from './types'

interface ServiceInstanceConfig {
  [INSTANCE_NAME_CONFIG_KEY]?: string
  enable?: boolean
}

export interface ServiceItemProps {
  serviceInstanceKey: string
  pluginList: ServicePluginMap
  deleteServiceInstance: (key: string) => void
  setCurrentConfigKey: (key: string) => void
  onConfigOpen: () => void
  serviceType: ServiceType
  builtinServices: BuiltinServices
  showEnableSwitch?: boolean
  guardMissingBuiltin?: boolean
  pluginLabelSeparator?: string
}

interface EnableSwitchProps {
  serviceInstanceKey: string
  serviceInstanceConfig: ServiceInstanceConfig
  setServiceInstanceConfig: (value: ServiceInstanceConfig, forceSync?: boolean) => Promise<void>
}

function EnableSwitch(props: EnableSwitchProps) {
  const { serviceInstanceKey, serviceInstanceConfig, setServiceInstanceConfig } = props
  const { saveConfig } = useConfigSave()

  return (
    <Switch
      size="sm"
      isSelected={serviceInstanceConfig.enable ?? true}
      onValueChange={(v) => {
        saveConfig(serviceInstanceKey, serviceInstanceConfig, setServiceInstanceConfig, {
          ...serviceInstanceConfig,
          enable: v,
        })
      }}
    />
  )
}

export default function ServiceItem(props: ServiceItemProps) {
  const {
    serviceInstanceKey,
    pluginList,
    deleteServiceInstance,
    setCurrentConfigKey,
    onConfigOpen,
    serviceType,
    builtinServices,
    showEnableSwitch = false,
    guardMissingBuiltin = true,
    pluginLabelSeparator = ' ',
  } = props
  const { t } = useTranslation()
  const [serviceInstanceConfig, setServiceInstanceConfig] = useConfig<ServiceInstanceConfig>(
    serviceInstanceKey,
    {},
  )

  const serviceSourceType = getServiceSouceType(serviceInstanceKey)
  const serviceName = getServiceName(serviceInstanceKey)
  const builtinService = builtinServices[serviceName]

  return (serviceSourceType === ServiceSourceType.PLUGIN && !(serviceName in pluginList)) ||
    (guardMissingBuiltin && serviceSourceType === ServiceSourceType.BUILDIN && !builtinService) ? (
    <></>
  ) : (
    serviceInstanceConfig !== null && (
      <div className="bg-content2 rounded-md px-2.5 py-5 flex justify-between">
        <div className="flex items-center gap-2">
          {serviceSourceType === ServiceSourceType.BUILDIN && (
            <>
              <img
                src={builtinService.info.icon}
                className={SERVICE_ICON_CLASS}
                draggable={false}
              />
              <h2 className="my-auto">
                {getDisplayInstanceName(serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ?? '', () =>
                  t(`services.${serviceType}.${serviceName}.title`),
                )}
              </h2>
            </>
          )}
          {serviceSourceType === ServiceSourceType.PLUGIN && (
            <>
              <img
                src={pluginList[serviceName].icon}
                className={SERVICE_ICON_CLASS}
                draggable={false}
              />
              <h2 className="my-auto">
                {`${getDisplayInstanceName(
                  serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ?? '',
                  () => pluginList[serviceName].display,
                )}${pluginLabelSeparator}[${t('common.plugin')}]`}
              </h2>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showEnableSwitch && (
            <EnableSwitch
              serviceInstanceKey={serviceInstanceKey}
              serviceInstanceConfig={serviceInstanceConfig}
              setServiceInstanceConfig={setServiceInstanceConfig}
            />
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => {
              setCurrentConfigKey(serviceInstanceKey)
              onConfigOpen()
            }}
          >
            <BiSolidEdit className="text-2xl" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={() => {
              deleteServiceInstance(serviceInstanceKey)
            }}
          >
            <MdDeleteOutline className="text-2xl" />
          </Button>
        </div>
      </div>
    )
  )
}
