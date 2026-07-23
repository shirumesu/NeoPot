import { Button, Dropdown, DropdownItem, DropdownTrigger } from '@heroui/react'
import type React from 'react'

import {
  getDisplayInstanceName,
  getServiceName,
  INSTANCE_NAME_CONFIG_KEY,
  whetherPluginService,
} from '@/renderer/lib/service/service_instance'
import SafeDropdownMenu from './SafeDropdownMenu'

interface ServiceDescriptor {
  icon: string
}

interface PluginServiceDescriptor extends ServiceDescriptor {
  display: string
}

interface ServiceInstanceDropdownProps {
  selectedKey: string
  instanceKeys: string[]
  serviceInstanceConfigMap: Record<string, Record<string, unknown>>
  pluginServices: Record<string, PluginServiceDescriptor>
  builtinServices: Record<string, { info: ServiceDescriptor }>
  getBuiltinLabel: (serviceName: string) => string
  ariaLabel: string
  onSelectionChange: (instanceKey: string) => void
  buttonClassName?: string
  buttonVariant?: 'solid' | 'bordered'
  iconClassName?: string
  menuClassName?: string
}

export default function ServiceInstanceDropdown({
  selectedKey,
  instanceKeys,
  serviceInstanceConfigMap,
  pluginServices,
  builtinServices,
  getBuiltinLabel,
  ariaLabel,
  onSelectionChange,
  buttonClassName,
  buttonVariant = 'bordered',
  iconClassName = 'h-5 my-auto',
  menuClassName = 'max-h-[70vh] overflow-y-auto',
}: ServiceInstanceDropdownProps) {
  const getDescriptor = (instanceKey: string) => {
    const serviceName = getServiceName(instanceKey)
    const plugin = whetherPluginService(instanceKey) ? pluginServices[serviceName] : undefined
    const builtin = plugin ? undefined : builtinServices[serviceName]
    const configuredName = serviceInstanceConfigMap[instanceKey]?.[INSTANCE_NAME_CONFIG_KEY]

    return {
      icon: plugin?.icon ?? builtin?.info.icon ?? '',
      label: getDisplayInstanceName(
        typeof configuredName === 'string' ? configuredName : '',
        () => plugin?.display ?? getBuiltinLabel(serviceName),
      ),
    }
  }

  const selected = getDescriptor(selectedKey)

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          className={buttonClassName}
          variant={buttonVariant}
          size="sm"
          startContent={<img className={iconClassName} src={selected.icon} />}
        >
          {selected.label}
        </Button>
      </DropdownTrigger>
      <SafeDropdownMenu
        aria-label={ariaLabel}
        className={menuClassName}
        onAction={(key: React.Key) => onSelectionChange(String(key))}
      >
        {instanceKeys.map((instanceKey) => {
          const descriptor = getDescriptor(instanceKey)
          return (
            <DropdownItem
              key={instanceKey}
              startContent={<img className={iconClassName} src={descriptor.icon} />}
            >
              {descriptor.label}
            </DropdownItem>
          )
        })}
      </SafeDropdownMenu>
    </Dropdown>
  )
}
