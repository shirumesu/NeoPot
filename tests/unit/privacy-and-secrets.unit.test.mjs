import assert from 'node:assert/strict'
import { test } from 'vitest'

import {
  SecretEncryptionUnavailableError,
  decryptSensitiveConfigValue,
  encryptSensitiveConfigValue,
  isEncryptedSecretValue,
  isSecretPath,
} from '../../src/main/modules/configSecrets.ts'
import {
  SENSITIVE_LOG_KEYS,
  errorToLogContext,
  formatLogContext,
  formatLogMessage,
  mergeLogContext,
} from '../../src/shared/logger.ts'
import { LOG_LEVELS, isLogLevel, toLogTransportLevel } from '../../src/shared/logLevel.ts'

const cipher = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: (value) => Buffer.from(`sealed:${value}`, 'utf8'),
  decryptString: (value) => value.toString('utf8').replace(/^sealed:/, ''),
})

test('secret path detection covers common credential spellings without flagging ordinary fields', () => {
  for (const path of [
    ['translate_deepl', 'authKey'],
    ['service', 'api-key'],
    ['nested', 'refresh token'],
    ['proxy', 'password'],
    ['oauth', 'access_token'],
  ]) {
    assert.equal(isSecretPath(path), true, path.join('.'))
  }

  for (const path of [
    ['translate', 'custom_url'],
    ['plugin', 'display'],
    ['general', 'server_port'],
  ]) {
    assert.equal(isSecretPath(path), false, path.join('.'))
  }
})

test('sensitive config encryption recursively seals strings and leaves non-secrets readable', () => {
  const encrypted = encryptSensitiveConfigValue(
    {
      authKey: 'deepl-secret',
      customUrl: 'https://api.example.test',
      nested: {
        token: 'nested-secret',
        label: 'visible',
      },
      access_tokens: ['first', 'second'],
      emptyPassword: '',
    },
    cipher(),
    ['translate_deepl'],
  )

  assert.equal(encrypted.customUrl, 'https://api.example.test')
  assert.equal(encrypted.nested.label, 'visible')
  assert.equal(encrypted.emptyPassword, '')
  assert.equal(isEncryptedSecretValue(encrypted.authKey), true)
  assert.equal(isEncryptedSecretValue(encrypted.nested.token), true)
  assert.equal(isEncryptedSecretValue(encrypted.access_tokens[0]), true)
  assert.notEqual(encrypted.authKey.value, Buffer.from('deepl-secret').toString('base64'))
})

test('sensitive config decryption restores provider credentials for current renderer consumers', () => {
  const sealed = encryptSensitiveConfigValue(
    {
      authKey: 'deepl-secret',
      nested: {
        accessToken: 'access-secret',
      },
      ordinary: 'visible',
    },
    cipher(),
    ['service'],
  )

  assert.deepEqual(decryptSensitiveConfigValue(sealed, cipher()), {
    authKey: 'deepl-secret',
    nested: {
      accessToken: 'access-secret',
    },
    ordinary: 'visible',
  })
})

test('non-empty secrets are refused when safe encryption is unavailable', () => {
  assert.throws(
    () => encryptSensitiveConfigValue({ authKey: 'deepl-secret' }, cipher(false), ['deepl']),
    SecretEncryptionUnavailableError,
  )

  assert.deepEqual(
    encryptSensitiveConfigValue(
      { authKey: '', customUrl: 'https://api.example.test' },
      cipher(false),
      ['deepl'],
    ),
    {
      authKey: '',
      customUrl: 'https://api.example.test',
    },
  )
})

test('log context formatting preserves useful metadata while redacting sensitive payloads', () => {
  assert.equal(
    formatLogContext({
      window: 'translate',
      count: 3,
      enabled: true,
      empty: null,
      list: [1, 2],
      meta: { a: 1, b: 2 },
      text: 'hello',
      refreshToken: 'abc',
      Authorization: 'Bearer xyz',
    }),
    'window=translate count=3 enabled=true empty=null list=[array length=2] meta=[object keys=2] text=[redacted length=5] refreshToken=[redacted length=3] Authorization=[redacted length=10]',
  )
})

test('log context stays parseable for whitespace and unusual characters', () => {
  assert.equal(
    formatLogContext({ msg: 'hello world', path: '/var/log/app.log' }),
    'msg="hello world" path=/var/log/app.log',
  )
  assert.equal(formatLogContext({ weird: 'a=b;c' }), 'weird="a=b;c"')
  assert.equal(formatLogContext({ '': 'drop me', kept: 1 }), 'kept=1')
})

test('logger privacy key list includes user content and credential fields', () => {
  for (const key of [
    'text',
    'result',
    'content',
    'base64',
    'token',
    'apiKey',
    'password',
    'authorization',
  ]) {
    assert.ok(SENSITIVE_LOG_KEYS.includes(key), `missing sensitive key: ${key}`)
  }
})

test('log message and error helpers produce actionable but bounded output', () => {
  assert.equal(formatLogMessage('Opened.', { window: 'config' }), 'Opened. window=config')
  assert.equal(formatLogMessage('Opened.', {}), 'Opened.')

  const error = new TypeError('bad input')
  const context = errorToLogContext(error)
  assert.equal(context.errorName, 'TypeError')
  assert.equal(context.message, 'bad input')
  assert.equal(typeof context.stack, 'string')
  assert.deepEqual(errorToLogContext(42), { message: '42' })
  assert.deepEqual(mergeLogContext({ a: 1 }, { a: 2, b: 3 }), { a: 2, b: 3 })
  assert.equal(mergeLogContext(undefined, undefined), undefined)
})

test('log level helpers accept only the transport levels the app supports', () => {
  assert.deepEqual([...LOG_LEVELS], ['error', 'warn', 'info', 'debug', 'silent'])
  for (const level of LOG_LEVELS) {
    assert.equal(isLogLevel(level), true)
  }
  for (const value of ['verbose', 'trace', '', 'Debug', null, undefined, 3, {}, ['debug']]) {
    assert.equal(isLogLevel(value), false, String(value))
  }
  assert.equal(toLogTransportLevel('silent'), false)
  assert.equal(toLogTransportLevel('debug'), 'debug')
})
