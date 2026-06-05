export interface SecretCipher {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export interface EncryptedSecretValue {
  __neopot_secret: true
  version: 1
  encoding: 'base64'
  value: string
}

export class SecretEncryptionUnavailableError extends Error {
  constructor() {
    super('Secret encryption is unavailable on this system.')
    this.name = 'SecretEncryptionUnavailableError'
  }
}

export const secretKeyFragments = [
  'api_key',
  'apikey',
  'auth_key',
  'authkey',
  'secret_key',
  'secretkey',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'password',
  'token',
]

const normalizeKey = (key: string): string => key.toLowerCase().replaceAll(/[-_\s]/g, '')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function isSecretPath(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizeKey(segment)
    return secretKeyFragments.some((fragment) => normalized.includes(normalizeKey(fragment)))
  })
}

export function isEncryptedSecretValue(value: unknown): value is EncryptedSecretValue {
  return (
    isRecord(value) &&
    value.__neopot_secret === true &&
    value.version === 1 &&
    value.encoding === 'base64' &&
    typeof value.value === 'string'
  )
}

function encryptSecretString(value: string, cipher: SecretCipher): EncryptedSecretValue {
  if (!cipher.isEncryptionAvailable()) {
    throw new SecretEncryptionUnavailableError()
  }

  return {
    __neopot_secret: true,
    version: 1,
    encoding: 'base64',
    value: cipher.encryptString(value).toString('base64'),
  }
}

export function encryptSensitiveConfigValue(
  value: unknown,
  cipher: SecretCipher,
  path: string[] = [],
): unknown {
  if (typeof value === 'string') {
    if (value === '' || !isSecretPath(path)) {
      return value
    }

    return encryptSecretString(value, cipher)
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      encryptSensitiveConfigValue(item, cipher, [...path, String(index)]),
    )
  }

  if (!isRecord(value) || isEncryptedSecretValue(value)) {
    return value
  }

  const encrypted: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    encrypted[key] = encryptSensitiveConfigValue(item, cipher, [...path, key])
  }

  return encrypted
}

export function decryptSensitiveConfigValue(value: unknown, cipher: SecretCipher): unknown {
  if (isEncryptedSecretValue(value)) {
    return cipher.decryptString(Buffer.from(value.value, 'base64'))
  }

  if (Array.isArray(value)) {
    return value.map((item) => decryptSensitiveConfigValue(item, cipher))
  }

  if (!isRecord(value)) {
    return value
  }

  const decrypted: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    decrypted[key] = decryptSensitiveConfigValue(item, cipher)
  }

  return decrypted
}
