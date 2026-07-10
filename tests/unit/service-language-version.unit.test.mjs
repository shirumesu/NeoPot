import assert from 'node:assert/strict'
import { test } from 'vitest'

import {
  ServiceSourceType,
  createServiceInstanceKey,
  getDisplayInstanceName,
  getServiceName,
  getServiceSouceType,
  isServiceInstanceForPlugin,
  isValidServiceInstanceKey,
  whetherAvailableService,
  whetherPluginService,
} from '../../src/shared/serviceInstance.ts'
import { LanguageFlag, languageList } from '../../src/renderer/lib/language/language.ts'
import {
  compareVersions,
  isPrereleaseVersion,
  isSemanticVersion,
  stripVersionPrefix,
} from '../../src/main/modules/updateVersion.ts'

test('service instance keys reject empty or non-string input but preserve legacy no-id keys', () => {
  assert.equal(isValidServiceInstanceKey('google@abc'), true)
  assert.equal(isValidServiceInstanceKey('deepl'), true)

  for (const value of ['', '   ', null, undefined, 123, {}]) {
    assert.equal(isValidServiceInstanceKey(value), false, String(value))
  }
})

test('service instance parsing keeps built-in and plugin providers in separate availability buckets', () => {
  const available = {
    [ServiceSourceType.BUILDIN]: { google: {}, deepl: {} },
    [ServiceSourceType.PLUGIN]: { plugin_translate_foo: {}, template_translate: {} },
  }

  assert.equal(getServiceSouceType('plugin:template_translate@1'), ServiceSourceType.PLUGIN)
  assert.equal(getServiceSouceType('plugin_translate_foo@1'), ServiceSourceType.PLUGIN)
  assert.equal(getServiceSouceType('plugin@1'), ServiceSourceType.PLUGIN)
  assert.equal(getServiceSouceType('google@1'), ServiceSourceType.BUILDIN)
  assert.equal(whetherPluginService('plugin:template_translate@1'), true)
  assert.equal(whetherPluginService('plugin_translate_foo@1'), true)
  assert.equal(whetherPluginService('google@1'), false)

  assert.equal(whetherAvailableService('google@inst1', available), true)
  assert.equal(whetherAvailableService('deepl', available), true)
  assert.equal(whetherAvailableService('ollama@inst1', available), false)
  assert.equal(whetherAvailableService('plugin:template_translate@inst1', available), true)
  assert.equal(whetherAvailableService('plugin_translate_foo@inst1', available), true)
  assert.equal(whetherAvailableService('plugin_translate_bar@inst1', available), false)
  assert.equal(whetherAvailableService('google@x', {}), false)
})

test('service instance key creation round-trips through service-name extraction', () => {
  const first = createServiceInstanceKey('deepl')
  const second = createServiceInstanceKey('deepl')
  const plugin = createServiceInstanceKey('template_translate', ServiceSourceType.PLUGIN)

  assert.match(first, /^deepl@.+/)
  assert.equal(getServiceName(first), 'deepl')
  assert.notEqual(first, second)
  assert.match(plugin, /^plugin:template_translate@.+/)
  assert.equal(getServiceName(plugin), 'template_translate')
  assert.equal(getServiceName('legacy'), 'legacy')
  assert.equal(getServiceName('weird@a@b'), 'weird')
})

test('plugin instance matching supports explicit keys and legacy plugin-name prefixes', () => {
  assert.equal(
    isServiceInstanceForPlugin('plugin:template_translate@1', 'template_translate'),
    true,
  )
  assert.equal(isServiceInstanceForPlugin('plugin_translate_foo@1', 'plugin_translate_foo'), true)
  assert.equal(isServiceInstanceForPlugin('template_translate@1', 'template_translate'), false)
  assert.equal(isServiceInstanceForPlugin('plugin:other@1', 'template_translate'), false)
})

test('service display names prefer explicit names and lazily call fallback suppliers', () => {
  let supplierCalls = 0
  const supplier = () => {
    supplierCalls += 1
    return 'DeepL'
  }

  assert.equal(getDisplayInstanceName('Custom', supplier), 'Custom')
  assert.equal(supplierCalls, 0)
  assert.equal(getDisplayInstanceName('', supplier), 'DeepL')
  assert.equal(supplierCalls, 1)
})

test('language selector data maps every selectable language to one flag code and no orphan flags', () => {
  for (const code of ['en', 'zh_cn', 'zh_tw', 'ja', 'ko', 'fr', 'de', 'ru']) {
    assert.ok(languageList.includes(code), `missing anchor language ${code}`)
  }

  assert.deepEqual(Object.keys(LanguageFlag).sort(), [...languageList].sort())
  for (const [code, flag] of Object.entries(LanguageFlag)) {
    assert.match(flag, /^[a-z]{2}$/, `${code} has invalid flag ${flag}`)
  }
  assert.equal(LanguageFlag.en, 'gb')
  assert.equal(LanguageFlag.zh_cn, 'cn')
  assert.equal(LanguageFlag.ja, 'jp')
  assert.equal(LanguageFlag.ko, 'kr')
})

test('semantic version parser accepts release tags and rejects malformed versions', () => {
  for (const value of ['1.2.3', 'v1.2.3', '1.2', '1', '1.2.3-beta.1', '1.2.3+build.7']) {
    assert.equal(isSemanticVersion(value), true, value)
  }
  for (const value of ['', 'latest', '1.2.x', '1.2.3.4', 'v']) {
    assert.equal(isSemanticVersion(value), false, value)
  }
})

test('semantic version comparison follows stable and prerelease precedence', () => {
  assert.ok(compareVersions('1.1.0-beta.10', '1.1.0-beta.2') > 0)
  assert.ok(compareVersions('v1.1.0-beta.2', '1.1.0-beta.10') < 0)
  assert.ok(compareVersions('1.1.0', '1.1.0-beta.10') > 0)
  assert.ok(compareVersions('1.1.0-alpha', '1.1.0-beta') < 0)
  assert.equal(compareVersions('1.1.0-beta.2', '1.1.0-beta.2'), 0)
  assert.ok(compareVersions('not-semver-b', 'not-semver-a') > 0)
})

test('version helpers tolerate tag prefixes and build metadata', () => {
  assert.equal(stripVersionPrefix(' v1.1.0-beta.1 '), '1.1.0-beta.1')
  assert.equal(isPrereleaseVersion('1.1.0-beta.1+build.7'), true)
  assert.equal(isPrereleaseVersion('1.1.0+build.7'), false)
})
