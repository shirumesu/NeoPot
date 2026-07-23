import assert from 'node:assert/strict'
import test from 'node:test'

import { functionText, parseSource } from '../shared/source.mjs'

const hotkey = parseSource('src', 'main', 'modules', 'hotkey.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const pluginHotkeyRuntime = parseSource('src', 'renderer', 'lib', 'plugin', 'plugin_hotkey.ts')

test('plugin IPC exposes the supported operations through validated payloads', () => {
  for (const handler of [
    'plugins:install',
    'plugins:install-url',
    'plugins:inspect-source',
    'plugins:inspect-marketplace',
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

test('plugin hotkey dispatch stays aligned across Main and renderer', () => {
  assert.match(functionText(hotkey, 'handlePluginHotkey'), /getInstalledPluginHotkey/)
  assert.match(
    functionText(hotkey, 'handlePluginHotkey'),
    /sendToPreferredWindow\('config', 'plugin_hotkey_triggered'/,
  )
  assert.match(
    functionText(pluginHotkeyRuntime, 'attachPluginHotkeyListener'),
    /plugin_hotkey_triggered/,
  )
  assert.match(
    functionText(pluginHotkeyRuntime, 'attachPluginHotkeyListener'),
    /invoke_plugin_handler/,
  )
})
