export enum ServiceSourceType {
  BUILDIN = 'buildin',
  PLUGIN = 'plugin',
}

const PLUGIN_INSTANCE_PREFIX = 'plugin:'

export function isValidServiceInstanceKey(
  serviceInstanceKey: unknown,
): serviceInstanceKey is string {
  return typeof serviceInstanceKey === 'string' && serviceInstanceKey.trim() !== ''
}

function baseServiceName(serviceInstanceKey: string): string {
  return serviceInstanceKey.split('@')[0]
}

export function getServiceSouceType(serviceInstanceKey: string): ServiceSourceType {
  const serviceName = baseServiceName(serviceInstanceKey)
  if (serviceName.startsWith(PLUGIN_INSTANCE_PREFIX) || serviceName.startsWith('plugin')) {
    return ServiceSourceType.PLUGIN
  }

  return ServiceSourceType.BUILDIN
}

export function whetherPluginService(serviceInstanceKey: string): boolean {
  return getServiceSouceType(serviceInstanceKey) === ServiceSourceType.PLUGIN
}

export function createServiceInstanceKey(
  serviceName: string,
  sourceType: ServiceSourceType = ServiceSourceType.BUILDIN,
): string {
  const randomId = Math.random().toString(36).substring(2)
  const encodedServiceName =
    sourceType === ServiceSourceType.PLUGIN
      ? `${PLUGIN_INSTANCE_PREFIX}${serviceName}`
      : serviceName

  return `${encodedServiceName}@${randomId}`
}

export function getServiceName(serviceInstanceKey: string): string {
  const serviceName = baseServiceName(serviceInstanceKey)
  return serviceName.startsWith(PLUGIN_INSTANCE_PREFIX)
    ? serviceName.slice(PLUGIN_INSTANCE_PREFIX.length)
    : serviceName
}

export function isServiceInstanceForPlugin(
  serviceInstanceKey: string,
  pluginName: string,
): boolean {
  return (
    whetherPluginService(serviceInstanceKey) && getServiceName(serviceInstanceKey) === pluginName
  )
}

export function getDisplayInstanceName(
  instanceName: string,
  serviceNameSupplier: () => string,
): string {
  return instanceName || serviceNameSupplier()
}

export const INSTANCE_NAME_CONFIG_KEY = 'instanceName'

export function whetherAvailableService(
  serviceInstanceKey: string,
  availableServices: Record<ServiceSourceType, Record<string, unknown>>,
) {
  const serviceSourceType = getServiceSouceType(serviceInstanceKey)
  const serviceName = getServiceName(serviceInstanceKey)
  return availableServices[serviceSourceType]?.[serviceName] !== undefined
}
