import assert from 'node:assert/strict'
import test from 'node:test'

import { functionText, parseSource, read } from '../shared/source.mjs'

const installer = parseSource('src', 'main', 'plugins', 'installer.ts')
const hotkey = parseSource('src', 'main', 'modules', 'hotkey.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const pluginRuntime = parseSource('src', 'renderer', 'lib', 'plugin', 'invoke_plugin.ts')
const pluginHotkeyRuntime = parseSource('src', 'renderer', 'lib', 'plugin', 'plugin_hotkey.ts')
const pluginCardLogic = parseSource(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Plugin',
  'logic.ts',
)
const pluginMarketplace = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Plugin',
  'marketplace.ts',
)
const installedPlugins = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Plugin',
  'installedPlugins.ts',
)
const selectPluginModal = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'Service',
  'SelectPluginModal',
  'index.tsx',
)

test('plugin IPC exposes install, inspect, list, enable, uninstall, and folder operations through validated payloads', () => {
  for (const handler of [
    'plugins:install',
    'plugins:install-url',
    'plugins:inspect-source',
    'plugins:inspect-marketplace',
    'plugins:list',
    'plugins:list-installed',
    'plugins:uninstall',
    'plugins:set-enabled',
    'plugins:open-folder',
  ]) {
    assert.match(ipc.text, new RegExp(`'${handler}'`), `missing ${handler}`)
  }

  assert.match(functionText(ipc, 'assertPluginInstallPayload'), /Expected a plugin file path/)
  assert.match(
    functionText(ipc, 'assertPluginInstallUrlPayload'),
    /Expected a plugin URL or local source path/,
  )
  assert.match(functionText(ipc, 'assertPluginIdentityPayload'), /Expected plugin type and name/)
  assert.match(
    functionText(ipc, 'assertPluginEnabledPayload'),
    /typeof payload\.enabled !== 'boolean'/,
  )
})

test('public plugin installation delegates validated core and registers default hotkeys', () => {
  assert.match(functionText(installer, 'installPlugin'), /createPluginInstallerCore/)
  assert.match(functionText(installer, 'installPlugin'), /installer\.installFromDirectory/)
  assert.match(functionText(installer, 'installPlugin'), /installer\.installFromZip/)
  assert.match(
    functionText(installer, 'installPlugin'),
    /registerPluginDefaultHotkeys\(result\.type, result\.name\)/,
  )
  assert.match(functionText(installer, 'installPluginFromUrl'), /installer\.installFromZip/)
  assert.match(functionText(installer, 'installPluginFromUrl'), /installSourceType: 'url'/)
  assert.match(
    functionText(installer, 'installPluginFromUrl'),
    /registerPluginDefaultHotkeys\(result\.type, result\.name\)/,
  )
  assert.match(functionText(installer, 'registerPluginDefaultHotkeys'), /isPluginHotkeyWithHandler/)
  assert.match(functionText(installer, 'registerPluginDefaultHotkeys'), /stored !== undefined/)
  assert.match(
    functionText(installer, 'registerPluginDefaultHotkeys'),
    /registerGlobalShortcutByName\(configKey, defaultShortcut\)/,
  )
})

test('plugin enable state affects hotkey registration without deleting user settings', () => {
  const setEnabled = functionText(installer, 'setPluginEnabled')

  assert.match(setEnabled, /setConfig\(pluginEnabledKey\(type, name\), enabled\)/)
  assert.match(setEnabled, /isPluginHotkeyWithHandler/)
  assert.match(setEnabled, /getHotkeyDefault/)
  assert.match(setEnabled, /registerGlobalShortcutByName\(configKey, shortcut\)/)
  assert.match(setEnabled, /globalShortcut\.unregister\(shortcut\.trim\(\)\)/)
  assert.doesNotMatch(setEnabled, /setConfig\(configKey, undefined\)/)
})

test('plugin uninstall removes hotkeys, enabled state, lang-detect selection, and stale service instances', () => {
  const uninstall = functionText(installer, 'uninstallPlugin')
  const removeInstances = functionText(installer, 'removePluginServiceInstances')

  assert.match(uninstall, /globalShortcut\.unregister\(shortcut\.trim\(\)\)/)
  assert.match(uninstall, /setConfig\(configKey, undefined\)/)
  assert.match(uninstall, /rm\(installedPluginDir\(type, name\)/)
  assert.match(uninstall, /setConfig\(pluginEnabledKey\(type, name\), undefined\)/)
  assert.match(uninstall, /type === 'lang_detect'/)
  assert.match(uninstall, /setConfig\('translate_detect_engine', 'local'\)/)
  assert.match(uninstall, /removePluginServiceInstances\(type, name\)/)

  assert.match(removeInstances, /SERVICE_PLUGIN_TYPES\.includes\(type\)/)
  assert.match(removeInstances, /const serviceListKey = `\$\{type\}_service_list`/)
  assert.match(removeInstances, /isServiceInstanceForPlugin\(instanceKey, name\)/)
  assert.match(removeInstances, /setConfig\(serviceListKey, retained\)/)
  assert.match(removeInstances, /setConfig\(instanceKey, undefined\)/)
})

test('plugin listing normalizes manifest defaults and suppresses invalid directory names', () => {
  assert.match(
    functionText(installer, 'readPluginManifest'),
    /const display = typeof manifest\.display === 'string' \? manifest\.display : name/,
  )
  assert.match(functionText(installer, 'readPluginManifest'), /\n {4}display,\n/)
  assert.match(
    functionText(installer, 'readPluginManifest'),
    /enabled: getPluginEnabled\(type, name\)/,
  )
  assert.match(functionText(installer, 'readPluginManifest'), /installSource/)
  assert.match(
    functionText(installer, 'readPluginManifest'),
    /needs: Array\.isArray\(manifest\.needs\) \? manifest\.needs : \[\]/,
  )
  assert.match(
    functionText(installer, 'readPluginManifest'),
    /hotkeys: Array\.isArray\(manifest\.hotkeys\) \? manifest\.hotkeys : \[\]/,
  )
  assert.match(
    functionText(installer, 'listInstalledPlugins'),
    /!isValidPluginIdentityPart\(pluginType\)/,
  )
  assert.match(
    functionText(installer, 'listInstalledPlugins'),
    /!isValidPluginIdentityPart\(entry\.name\)/,
  )
})

test('Main hotkey module dispatches plugin hotkeys to renderer handlers instead of host-defined URLs', () => {
  assert.match(functionText(hotkey, 'handlePluginHotkey'), /getInstalledPluginHotkey/)
  assert.match(functionText(hotkey, 'handlePluginHotkey'), /handler\.trim\(\)/)
  assert.match(
    functionText(hotkey, 'handlePluginHotkey'),
    /sendToPreferredWindow\('config', 'plugin_hotkey_triggered'/,
  )
  assert.doesNotMatch(functionText(hotkey, 'handlePluginHotkey'), /openExternal|openUrl|url/)
  assert.match(
    functionText(pluginHotkeyRuntime, 'attachPluginHotkeyListener'),
    /plugin_hotkey_triggered/,
  )
  assert.match(
    functionText(pluginHotkeyRuntime, 'attachPluginHotkeyListener'),
    /invoke_plugin_handler/,
  )
})

test('renderer plugin runtime reads installed main.js through AppConfig and injects only explicit utilities', () => {
  assert.match(
    functionText(pluginRuntime, 'getPluginRuntime'),
    /readTextFile\(`plugins\/\$\{pluginType\}\/\$\{pluginName\}\/main\.js`/,
  )
  assert.match(functionText(pluginRuntime, 'getPluginRuntime'), /baseDir: BaseDirectory\.AppConfig/)
  assert.match(
    functionText(pluginRuntime, 'getPluginRuntime'),
    /plugin_options:\$\{pluginType\}:\$\{pluginName\}/,
  )
  assert.match(functionText(pluginRuntime, 'sandboxHtml'), /tauriFetch: fetch/)
  assert.match(functionText(pluginRuntime, 'sandboxHtml'), /http: \{ fetch, Body \}/)
  assert.match(functionText(pluginRuntime, 'sandboxHtml'), /run: \(cmdName, args\) => rpc\('run'/)
  assert.match(functionText(pluginRuntime, 'invoke_plugin_handler'), /handler/)
  assert.match(functionText(pluginRuntime, 'invoke_plugin_handler'), /callSandbox\([\s\S]*handler/)
})

test('Plugin page action visibility hides settings and hotkeys when a plugin is disabled', () => {
  assert.match(
    functionText(pluginCardLogic, 'getCardActions'),
    /const enabled = plugin\.enabled !== false/,
  )
  assert.match(functionText(pluginCardLogic, 'getCardActions'), /homepage: enabled/)
  assert.match(functionText(pluginCardLogic, 'getCardActions'), /settings: enabled/)
  assert.match(functionText(pluginCardLogic, 'getCardActions'), /hotkey: enabled/)
  assert.match(functionText(pluginCardLogic, 'getCardActions'), /delete: true/)
  assert.match(functionText(pluginCardLogic, 'getCardActions'), /enable: true/)
})

test('marketplace update checks inspect installSource, download, and dev sources before choosing highest valid manifest version', () => {
  assert.match(pluginMarketplace, /DEFAULT_MARKETPLACE_SOURCE/)
  assert.match(pluginMarketplace, /plugin_marketplace_sources/)
  assert.match(pluginMarketplace, /mergeMarketplacePlugin/)
  assert.match(pluginMarketplace, /compareVersion\(remote\.version, installed\.version\) > 0/)
  assert.match(pluginMarketplace, /addSource\(installed\.installSource\)/)
  assert.match(pluginMarketplace, /marketplaceInstallSources\(marketplacePlugin\)/)
  assert.match(pluginMarketplace, /pluginApi\.inspectSource\(source\)/)
  assert.match(pluginMarketplace, /sourceManifest\.plugin_type !== installed\.type/)
  assert.match(pluginMarketplace, /sourceManifest\.name !== installed\.name/)
  assert.match(pluginMarketplace, /compareVersion\(sourceVersion, highestVersion\) > 0/)
})

test('service picker creates distinct plugin service instances and installed plugin loader preserves enable state', () => {
  assert.match(selectPluginModal, /ServiceSourceType\.PLUGIN/)
  assert.match(selectPluginModal, /createServiceInstanceKey\(x, ServiceSourceType\.PLUGIN\)/)
  assert.match(installedPlugins, /pluginApi\.listInstalled/)
  assert.match(installedPlugins, /enabled: record\.enabled !== false/)
  assert.match(installedPlugins, /plugin\.enabled && servicePluginTypes\.includes\(plugin\.type\)/)
})
