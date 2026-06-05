import type { ComponentType } from 'react'

import type { ServiceType } from '@/renderer/lib/service/service_instance'
import type { InstalledPlugin } from '../Plugin/installedPlugins'

export const SERVICE_ICON_CLASS = 'h-6 w-6 shrink-0'

export type ServicePluginMap = Record<string, InstalledPlugin>

export interface ServiceConfigComponentProps {
  name: string
  instanceKey: string
  pluginType: ServiceType
  pluginList: ServicePluginMap
  updateServiceList: (key: string) => void | Promise<void>
  onClose: () => void
}

export interface BuiltinService {
  info: {
    icon?: string
    name?: string
  }
  Config?: ComponentType<ServiceConfigComponentProps>
}

export type BuiltinServices = Record<string, BuiltinService>
