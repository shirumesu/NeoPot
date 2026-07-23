import { getStoreValue } from '@/renderer/lib/config/store'

export type ServiceInstanceConfigMap = Record<string, Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadServiceInstanceConfigMap(
  serviceInstanceKeys: Iterable<string>,
): Promise<ServiceInstanceConfigMap> {
  const configEntries = await Promise.all(
    [...new Set(serviceInstanceKeys)].map(async (serviceInstanceKey) => {
      const value = await getStoreValue(serviceInstanceKey)
      return [serviceInstanceKey, isRecord(value) ? value : {}] as const
    }),
  )

  return Object.fromEntries(configEntries)
}
