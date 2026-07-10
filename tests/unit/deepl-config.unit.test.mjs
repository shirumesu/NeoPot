import assert from 'node:assert/strict'
import { test } from 'vitest'

import {
  createDeepLXAuthHeaders,
  getDeepLXCustomUrl,
  getDeepLConfigFieldVisibility,
  normalizeDeepLConfig,
  normalizeDeepLServiceType,
} from '../../src/shared/deeplConfig.ts'

test('DeepL config normalization migrates legacy flat fields into service-specific storage', () => {
  const normalized = normalizeDeepLConfig({
    instanceName: 'My DeepL',
    enable: false,
    type: 'deeplx',
    authKey: 'auth-api-key',
    customUrl: 'http://127.0.0.1:1188/translate',
  })

  assert.equal(normalized.instanceName, 'My DeepL')
  assert.equal(normalized.enable, false)
  assert.equal(normalized.type, 'deeplx')
  assert.deepEqual(normalized.authApi, {
    authKey: 'auth-api-key',
  })
  assert.deepEqual(normalized.deeplx, {
    authKey: '',
    customUrl: 'http://127.0.0.1:1188/translate',
  })
  assert.equal(Object.hasOwn(normalized, 'authKey'), false)
  assert.equal(Object.hasOwn(normalized, 'customUrl'), false)
})

test('DeepL service-specific credentials stay separated from stale flat fields', () => {
  const normalized = normalizeDeepLConfig({
    type: 'api',
    authKey: 'legacy-auth-api-key',
    customUrl: 'https://legacy-deeplx.example.test',
    authApi: {
      authKey: '',
    },
    deeplx: {
      authKey: 'deeplx-token',
      customUrl: 'https://deeplx.example.test',
    },
  })

  assert.equal(normalized.authApi.authKey, '')
  assert.equal(normalized.deeplx.authKey, 'deeplx-token')
  assert.equal(normalized.deeplx.customUrl, 'https://deeplx.example.test')
})

test('DeepL service type and DeepLX URL helpers normalize invalid or legacy input', () => {
  assert.equal(normalizeDeepLServiceType('api'), 'api')
  assert.equal(normalizeDeepLServiceType('auth_api'), 'api')
  assert.equal(normalizeDeepLServiceType('authApi'), 'api')
  assert.equal(normalizeDeepLServiceType(undefined), 'free')
  assert.equal(
    getDeepLXCustomUrl({ customUrl: 'http://localhost:1188/translate' }),
    'http://localhost:1188/translate',
  )
  assert.equal(
    getDeepLXCustomUrl({ deeplx: { customUrl: 'http://localhost:1199/translate' } }),
    'http://localhost:1199/translate',
  )
})

test('DeepLX auth headers are optional bearer-token headers', () => {
  assert.deepEqual(createDeepLXAuthHeaders(''), {})
  assert.deepEqual(createDeepLXAuthHeaders('   '), {})
  assert.deepEqual(createDeepLXAuthHeaders('  token-value  '), {
    Authorization: 'Bearer token-value',
  })
})

test('DeepL config field visibility matches the selected service type', () => {
  assert.deepEqual(getDeepLConfigFieldVisibility('free'), {
    authApiAuthKey: false,
    deeplxAuthKey: false,
    deeplxCustomUrl: false,
  })
  assert.deepEqual(getDeepLConfigFieldVisibility('api'), {
    authApiAuthKey: true,
    deeplxAuthKey: false,
    deeplxCustomUrl: false,
  })
  assert.deepEqual(getDeepLConfigFieldVisibility('auth_api'), {
    authApiAuthKey: true,
    deeplxAuthKey: false,
    deeplxCustomUrl: false,
  })
  assert.deepEqual(getDeepLConfigFieldVisibility('deeplx'), {
    authApiAuthKey: false,
    deeplxAuthKey: true,
    deeplxCustomUrl: true,
  })
})

test('DeepL config normalization keeps the selected type and its fields for reopening settings', () => {
  assert.deepEqual(
    normalizeDeepLConfig({
      type: 'api',
      authApi: {
        authKey: 'auth-api-key',
      },
      deeplx: {
        authKey: 'deeplx-token',
        customUrl: 'http://localhost:1188/translate',
      },
    }),
    {
      instanceName: 'DeepL',
      type: 'api',
      authApi: {
        authKey: 'auth-api-key',
      },
      deeplx: {
        authKey: 'deeplx-token',
        customUrl: 'http://localhost:1188/translate',
      },
    },
  )

  assert.deepEqual(
    normalizeDeepLConfig({
      type: 'deeplx',
      authApi: {
        authKey: 'auth-api-key',
      },
      deeplx: {
        authKey: 'deeplx-token',
        customUrl: 'http://localhost:1188/translate',
      },
    }),
    {
      instanceName: 'DeepL',
      type: 'deeplx',
      authApi: {
        authKey: 'auth-api-key',
      },
      deeplx: {
        authKey: 'deeplx-token',
        customUrl: 'http://localhost:1188/translate',
      },
    },
  )
})
