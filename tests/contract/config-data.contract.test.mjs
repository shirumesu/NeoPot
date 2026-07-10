import assert from 'node:assert/strict'
import test from 'node:test'

import { assertTextOrder, functionText, parseSource, read } from '../shared/source.mjs'

const config = parseSource('src', 'main', 'modules', 'config.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const configStore = parseSource('src', 'renderer', 'lib', 'config', 'store.ts')
const dataMigration = parseSource('src', 'main', 'modules', 'data-migration.ts')
const generalSettings = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'General',
  'index.tsx',
)
const translateSettings = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Translate',
  'index.tsx',
)

test('Main config initializes migration once before runtime settings are consumed', () => {
  assert.match(config.text, /let migrationStarted = false/)
  assert.match(functionText(config, 'initializeConfig'), /if \(migrationStarted\)/)
  assert.match(functionText(config, 'initializeConfig'), /await runDataMigration\(\)/)
})

test('config:get routes direct reads through the redaction boundary', () => {
  assert.match(ipc.text, /'config:get': \(_event, payload\) =>/)
  assert.match(ipc.text, /return getRedactedConfig\(key\)/)
})

test('config:set persists through Main and reapplies runtime consumers before key-only broadcast', () => {
  const configSet = ipc.text.match(
    /'config:set': async \(_event, payload\) => \{[\s\S]*?\n {4}\},/,
  )?.[0]
  assert.ok(configSet, 'missing config:set handler')

  assert.match(configSet, /await setConfig\(key, value\)/)
  assert.match(configSet, /key === 'clipboard_monitor'/)
  assert.match(configSet, /setClipboardMonitorEnabled\(Boolean\(value\)\)/)
  assert.match(configSet, /'proxy_enable'/)
  assert.match(configSet, /'proxy_password'/)
  assert.match(configSet, /await applyProxyToSession\(\)/)
  assert.match(configSet, /broadcastAppEvent\('config:changed', \{ key \}\)/)
  assert.doesNotMatch(configSet, /broadcastAppEvent\('config:changed', \{ key, value \}\)/)
  assertTextOrder(
    configSet,
    [
      'await setConfig(key, value)',
      'setClipboardMonitorEnabled(Boolean(value))',
      "broadcastAppEvent('config:changed', { key })",
    ],
    'clipboard monitor config must be persisted and applied before broadcast',
  )
  assertTextOrder(
    configSet,
    [
      'await setConfig(key, value)',
      'await applyProxyToSession()',
      "broadcastAppEvent('config:changed', { key })",
    ],
    'proxy config must be persisted and applied before broadcast',
  )
})

test('renderer store uses Electron config API when present and listens for key-only reload events', () => {
  assert.match(configStore.text, /const CONFIG_CHANGED_APP_EVENT = 'config:changed'/)
  assert.match(functionText(configStore, 'getElectronConfigApi'), /window\.neoPot\?\.config/)
  assert.match(
    functionText(configStore, 'subscribeElectronConfigChanges'),
    /window\.neoPot\.app\.onEvent/,
  )
  assert.match(
    functionText(configStore, 'subscribeElectronConfigChanges'),
    /typeof payload\.key !== 'string'/,
  )
  assert.match(
    functionText(configStore, 'subscribeElectronConfigChanges'),
    /emitStoreValueReloaded\(payload\.key\)/,
  )
  assert.match(functionText(configStore, 'getStoreValue'), /electronConfig\.get\(key\)/)
  assert.match(functionText(configStore, 'setStoreValue'), /electronConfig\.set\(key, value\)/)
  assert.match(
    functionText(configStore, 'deleteStoreValue'),
    /electronConfig\.set\(key, undefined\)/,
  )
  assert.match(functionText(configStore, 'reloadStoreFromDisk'), /emitStoreReloaded\(\)/)
})

test('settings pages explicitly reapply Main-side effects for clipboard monitor and proxy toggles', () => {
  assert.match(translateSettings, /useConfig\('clipboard_monitor', false\)/)
  assert.match(translateSettings, /invoke\('set_clipboard_monitor', \{ enabled: v \}\)/)
  assert.match(generalSettings, /saveConfig\('proxy_enable'/)
  assert.match(generalSettings, /invoke\(v \? 'set_proxy' : 'unset_proxy'\)/)
  assert.match(generalSettings, /invoke\(v \? 'unset_proxy' : 'set_proxy'\)/)
})

test('display language flags render SVG URLs as images instead of CSS background URLs', () => {
  const flagIcon = generalSettings.match(/function LanguageFlagIcon\([\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(flagIcon, /<img/)
  assert.match(flagIcon, /src=\{getLanguageFlagUrl\(language\)\}/)
  assert.doesNotMatch(flagIcon, /backgroundImage/)
})

test('translate window size settings keep adaptive and remembered size mutually exclusive', () => {
  const positionIndex = translateSettings.indexOf('config.translate.window_position')
  const adaptiveIndex = translateSettings.indexOf('config.translate.adaptive_window_size')
  const rememberIndex = translateSettings.indexOf('config.translate.remember_window_size')

  assert.ok(positionIndex >= 0, 'missing window position setting')
  assert.ok(adaptiveIndex > positionIndex, 'adaptive size must follow window position')
  assert.ok(rememberIndex > adaptiveIndex, 'remembered size must follow adaptive size')
  assert.match(
    translateSettings,
    /useConfig\([\s\S]*'translate_adaptive_window_size'[\s\S]*false[\s\S]*\)/,
  )
  assert.match(
    translateSettings,
    /'translate_remember_window_size'[\s\S]*setRememberWindowSize[\s\S]*false[\s\S]*notify: false/,
  )
  assert.match(
    translateSettings,
    /'translate_adaptive_window_size'[\s\S]*setAdaptiveWindowSize[\s\S]*false[\s\S]*notify: false/,
  )
})

test('legacy data migration backs up removed Pot data instead of reintroducing old runtime stores', () => {
  assert.match(functionText(dataMigration, 'legacyBasePath'), /com\.pot-app\.desktop/)
  assert.match(functionText(dataMigration, 'detectLegacyData'), /config\.json/)
  assert.match(functionText(dataMigration, 'detectLegacyData'), /history\.db/)
  assert.match(functionText(dataMigration, 'detectLegacyData'), /plugins/)
  assert.match(functionText(dataMigration, 'createBackup'), /legacy-backup/)
  assert.match(functionText(dataMigration, 'createBackup'), /copyFile\(detection\.configPath/)
  assert.match(functionText(dataMigration, 'createBackup'), /copyFile\(detection\.historyPath/)
  assert.match(functionText(dataMigration, 'createBackup'), /cp\(detection\.pluginsPath/)
  assert.doesNotMatch(dataMigration.text, /restore/i)
  assert.doesNotMatch(dataMigration.text, /historyDb/i)
})
