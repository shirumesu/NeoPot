import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSetEqual,
  collectAllSwitchCaseLabels,
  collectInterfaceMemberNames,
  collectNewSetStringLiterals,
  collectStringLiteralUnion,
  collectVariableObjectKeys,
  parseSource,
  read,
  variableText,
  walkFiles,
} from '../shared/source.mjs'

const preload = parseSource('src', 'preload', 'index.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const dts = parseSource('src', 'shared', 'types', 'electron-api.d.ts')
const command = parseSource('src', 'renderer', 'lib', 'electron', 'command.ts')

const EXPECTED_API_NAMESPACES = [
  'app',
  'command',
  'config',
  'dialog',
  'fs',
  'hotkey',
  'http',
  'path',
  'plugins',
  'services',
  'updater',
  'workflow',
]

const unionChannels = collectStringLiteralUnion(preload, 'IpcChannel')
const allowlistedChannels = collectNewSetStringLiterals(preload, 'channels')
const mainHandlerChannels = collectVariableObjectKeys(ipc, 'handlers')
const apiNamespaces = collectVariableObjectKeys(preload, 'api')
const typedNamespaces = collectInterfaceMemberNames(dts, 'NeoPotElectronApi')
const declaredCommands = collectInterfaceMemberNames(command, 'ElectronCommandMap')
const mainCommandCases = collectAllSwitchCaseLabels(ipc)

function rendererIssuedCommands() {
  const commands = new Set()
  const rendererFiles = walkFiles('src', 'renderer').filter((file) => /\.(ts|tsx)$/.test(file))

  for (const file of rendererFiles) {
    const source = read(file)
    for (const match of source.matchAll(
      /(?:invokeCommand|command\.invoke)\s*(?:<[^>]+>)?\(\s*'([^']+)'/g,
    )) {
      commands.add(match[1])
    }
    for (const match of source.matchAll(/invokeCommand\(v \? '([^']+)' : '([^']+)'\)/g)) {
      commands.add(match[1])
      commands.add(match[2])
    }
  }

  return [...commands].sort()
}

test('preload IPC channel type, allowlist, and Main handler map stay exactly aligned', () => {
  assertSetEqual(unionChannels, allowlistedChannels, 'IpcChannel union drifted from channels Set')
  assertSetEqual(
    allowlistedChannels,
    mainHandlerChannels,
    'preload allowlist drifted from Main ipc handlers',
  )
  assert.equal(new Set(mainHandlerChannels).size, mainHandlerChannels.length)
})

test('preload runtime API and shared renderer type expose the same namespaces', () => {
  assert.deepEqual(apiNamespaces, EXPECTED_API_NAMESPACES)
  assert.deepEqual(typedNamespaces, EXPECTED_API_NAMESPACES)
})

test('every checked preload invocation targets an allowlisted Main channel', () => {
  const apiSource = variableText(preload, 'api')
  const invokedChannels = [...apiSource.matchAll(/invokeChecked(?:<[^>]+>)?\(\s*'([^']+)'/g)].map(
    (match) => match[1],
  )

  assert.ok(
    invokedChannels.length >= 40,
    `unexpectedly few checked invocations: ${invokedChannels}`,
  )
  assert.deepEqual(
    invokedChannels.filter((channel) => !allowlistedChannels.includes(channel)),
    [],
    'preload invokes a channel that is not allowlisted',
  )
})

test('renderer declared and actually issued command:invoke commands are dispatched by Main', () => {
  const issuedCommands = rendererIssuedCommands()
  const expectedRuntimeCommands = [
    'copy_img',
    'cut_image',
    'font_list',
    'get_base64',
    'get_text',
    'lang_detect',
    'log:set-level',
    'open_config_dir',
    'open_devtools',
    'open_log_dir',
    'open_url',
    'register_shortcut_by_frontend',
    'run_binary',
    'screenshot',
    'screenshot_complete',
    'set_clipboard_monitor',
    'set_proxy',
    'translate_text',
    'unset_proxy',
    'update_tray',
  ]

  assertSetEqual(issuedCommands, expectedRuntimeCommands, 'renderer command surface changed')
  assert.deepEqual(
    declaredCommands.filter((commandName) => !mainCommandCases.includes(commandName)),
    [],
    'typed renderer commands missing Main switch cases',
  )
  assert.deepEqual(
    issuedCommands.filter((commandName) => !mainCommandCases.includes(commandName)),
    [],
    'renderer-issued commands missing Main switch cases',
  )
})

test('typed workflow bridge covers the four user-triggered workflow commands', () => {
  for (const channel of [
    'workflow:selection-translate',
    'workflow:input-translate',
    'workflow:ocr-recognize',
    'workflow:ocr-translate',
  ]) {
    assert.ok(allowlistedChannels.includes(channel), `missing preload channel ${channel}`)
    assert.ok(mainHandlerChannels.includes(channel), `missing Main handler ${channel}`)
  }

  const apiSource = variableText(preload, 'api')
  for (const method of ['selectionTranslate', 'inputTranslate', 'ocrRecognize', 'ocrTranslate']) {
    assert.match(apiSource, new RegExp(`${method}:`), `missing preload workflow method ${method}`)
  }
})
