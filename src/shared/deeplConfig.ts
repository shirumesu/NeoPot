export const DEEPL_SERVICE_TYPES = ['free', 'api', 'deeplx'] as const

export type DeepLServiceType = (typeof DEEPL_SERVICE_TYPES)[number]

export interface DeepLAuthApiConfig {
  authKey: string
}

export interface DeepLXConfig {
  authKey: string
  customUrl: string
}

export interface DeepLConfig extends Record<string, unknown> {
  instanceName: string
  type: DeepLServiceType
  authApi: DeepLAuthApiConfig
  deeplx: DeepLXConfig
}

export interface DeepLConfigFieldVisibility {
  authApiAuthKey: boolean
  deeplxAuthKey: boolean
  deeplxCustomUrl: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

const legacyDeepLConfigKeys = new Set(['type', 'authKey', 'customUrl', 'authApi', 'deeplx'])

const readString = (record: Record<string, unknown>, key: string, fallback = ''): string => {
  if (!hasOwn(record, key)) {
    return fallback
  }

  const value = record[key]
  return typeof value === 'string' ? value : fallback
}

export function isDeepLServiceType(value: unknown): value is DeepLServiceType {
  return DEEPL_SERVICE_TYPES.includes(value as DeepLServiceType)
}

export function normalizeDeepLServiceType(value: unknown): DeepLServiceType {
  if (value === 'auth_api' || value === 'authApi') {
    return 'api'
  }

  return isDeepLServiceType(value) ? value : 'free'
}

export function createDefaultDeepLConfig(instanceName = 'DeepL'): DeepLConfig {
  return {
    instanceName,
    type: 'free',
    authApi: {
      authKey: '',
    },
    deeplx: {
      authKey: '',
      customUrl: '',
    },
  }
}

export function normalizeDeepLConfig(value: unknown, defaultInstanceName = 'DeepL'): DeepLConfig {
  const record = isRecord(value) ? value : {}
  const authApiRecord = isRecord(record.authApi) ? record.authApi : {}
  const deeplxRecord = isRecord(record.deeplx) ? record.deeplx : {}
  const sharedConfig = Object.fromEntries(
    Object.entries(record).filter(([key]) => !legacyDeepLConfigKeys.has(key)),
  )

  return {
    ...sharedConfig,
    instanceName: readString(record, 'instanceName', defaultInstanceName),
    type: normalizeDeepLServiceType(record.type),
    authApi: {
      authKey: readString(authApiRecord, 'authKey', readString(record, 'authKey')),
    },
    deeplx: {
      authKey: readString(deeplxRecord, 'authKey'),
      customUrl: readString(deeplxRecord, 'customUrl', readString(record, 'customUrl')),
    },
  }
}

export function getDeepLXCustomUrl(value: unknown): string {
  return normalizeDeepLConfig(value).deeplx.customUrl
}

export function createDeepLXAuthHeaders(authKey: string): Record<string, string> {
  const normalizedAuthKey = authKey.trim()
  if (!normalizedAuthKey) {
    return {}
  }

  return {
    Authorization: `Bearer ${normalizedAuthKey}`,
  }
}

export function getDeepLConfigFieldVisibility(serviceType: unknown): DeepLConfigFieldVisibility {
  const normalizedServiceType = normalizeDeepLServiceType(serviceType)

  return {
    authApiAuthKey: normalizedServiceType === 'api',
    deeplxAuthKey: normalizedServiceType === 'deeplx',
    deeplxCustomUrl: normalizedServiceType === 'deeplx',
  }
}
