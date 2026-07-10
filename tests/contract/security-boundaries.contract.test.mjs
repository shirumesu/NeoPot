import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectImports,
  functionText,
  parseSource,
  read,
  variableText,
  walkFiles,
} from '../shared/source.mjs'

const mainIndex = parseSource('src', 'main', 'index.ts')
const windowSource = parseSource('src', 'main', 'modules', 'window.ts')
const preload = parseSource('src', 'preload', 'index.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const http = parseSource('src', 'main', 'modules', 'http.ts')
const networkSafety = parseSource('src', 'main', 'modules', 'networkSafety.ts')
const externalUrlSafety = parseSource('src', 'main', 'modules', 'externalUrlSafety.ts')
const shellSafety = parseSource('src', 'main', 'modules', 'shellSafety.ts')
const updater = parseSource('src', 'main', 'modules', 'updater.ts')
const pluginBinary = parseSource('src', 'main', 'plugins', 'binary.ts')
const pluginRuntime = parseSource('src', 'renderer', 'lib', 'plugin', 'invoke_plugin.ts')

const srcFiles = walkFiles('src').filter((file) => /\.(ts|tsx)$/.test(file))
const rendererFiles = srcFiles.filter((file) => /[\\/]renderer[\\/]/.test(file))

test('no source turns off renderer process isolation or sandboxing', () => {
  const offenders = []
  for (const file of srcFiles) {
    const text = read(file)
    if (/nodeIntegration:\s*true/.test(text)) offenders.push(`${file}: nodeIntegration:true`)
    if (/contextIsolation:\s*false/.test(text)) offenders.push(`${file}: contextIsolation:false`)
    if (/\bsandbox:\s*false/.test(text)) offenders.push(`${file}: sandbox:false`)
    if (/webSecurity:\s*false/.test(text)) offenders.push(`${file}: webSecurity:false`)
  }
  assert.deepEqual(offenders, [])

  const createWindow = functionText(windowSource, 'createBrowserWindow')
  assert.match(createWindow, /contextIsolation:\s*true/)
  assert.match(createWindow, /nodeIntegration:\s*false/)
  assert.match(createWindow, /sandbox:\s*true/)
  assert.match(createWindow, /webSecurity:\s*true/)
})

test('renderer code does not import Electron or use raw ipcRenderer', () => {
  const offenders = []
  for (const file of rendererFiles) {
    const text = read(file)
    if (/\bipcRenderer\b/.test(text)) offenders.push(`${file}: ipcRenderer`)
    if (/from ['"]electron['"]/.test(text)) offenders.push(`${file}: import electron`)
    if (/require\(['"]electron['"]\)/.test(text)) offenders.push(`${file}: require electron`)
  }
  assert.deepEqual(offenders, [])
})

test('preload exposes one allowlisted bridge only to trusted renderer origins', () => {
  assert.deepEqual(
    collectImports(preload).filter((source) => source.startsWith('node:')),
    [],
  )
  assert.match(functionText(preload, 'isTrustedRendererLocation'), /protocol === 'neopot:'/)
  assert.match(functionText(preload, 'isTrustedRendererLocation'), /hostname === 'localhost'/)
  assert.match(functionText(preload, 'isTrustedRendererLocation'), /hostname === '127\.0\.0\.1'/)
  assert.match(functionText(preload, 'isTrustedRendererLocation'), /hostname === '\[::1\]'/)
  assert.match(functionText(preload, 'invokeChecked'), /if \(!channels\.has\(channel\)\)/)
  assert.match(functionText(preload, 'invokeChecked'), /Unknown IPC channel/)
  assert.match(preload.text, /contextBridge\.exposeInMainWorld\('neoPot', api\)/)
})

test('packaged renderer scheme is privileged and registered before app readiness', () => {
  const schemeIndex = mainIndex.text.indexOf('protocol.registerSchemesAsPrivileged')
  const readyIndex = mainIndex.text.indexOf('app.whenReady')

  assert.ok(schemeIndex >= 0, 'missing registerSchemesAsPrivileged')
  assert.ok(readyIndex >= 0, 'missing app.whenReady')
  assert.ok(schemeIndex < readyIndex, 'renderer scheme must be registered before app.whenReady')
  assert.match(mainIndex.text, /scheme: RENDERER_SCHEME/)
  assert.match(mainIndex.text, /standard:\s*true/)
  assert.match(mainIndex.text, /secure:\s*true/)
  assert.match(mainIndex.text, /supportFetchAPI:\s*true/)
  assert.match(mainIndex.text, /requestSingleInstanceLock\(\)/)
})

test('filesystem IPC resolves only allowed bases and limits delete operations to AppCache', () => {
  assert.match(ipc.text, /type SupportedBaseDirectory = 'AppConfig' \| 'AppCache' \| 'AppLog'/)
  assert.match(functionText(ipc, 'assertPathInside'), /path\.resolve\(parent\)/)
  assert.match(
    functionText(ipc, 'resolveFilePath'),
    /Relative filesystem paths require a supported baseDir/,
  )
  assert.match(
    functionText(ipc, 'resolveFilePath'),
    /Absolute filesystem paths are limited to NeoPot app data paths/,
  )
  assert.match(functionText(ipc, 'resolveRemovableFilePath'), /baseDir !== 'AppCache'/)
  assert.match(
    functionText(ipc, 'resolveRemovableFilePath'),
    /Renderer delete operations are limited to AppCache/,
  )
  assert.doesNotMatch(
    functionText(ipc, 'resolveFilePath'),
    /path\.join\(basePath, filePath\) : filePath/,
  )
})

test('external shell opening and updater release pages go through explicit allowlists', () => {
  assert.match(variableText(externalUrlSafety, 'defaultAllowedProtocols'), /'https:'/)
  assert.match(variableText(externalUrlSafety, 'defaultAllowedProtocols'), /'mailto:'/)
  assert.match(
    functionText(shellSafety, 'safeOpenExternal'),
    /assertSafeExternalUrl\(input, options\)/,
  )
  assert.match(functionText(updater, 'openReleasePage'), /safeOpenExternal\(target/)
  assert.match(functionText(updater, 'openReleasePage'), /allowedHosts: \['github\.com'\]/)
  assert.match(functionText(updater, 'openReleasePage'), /allowSubdomains: false/)
  assert.match(ipc.text, /safeOpenExternal\(assertUrlPayload\(args\)\)/)
})

test('renderer HTTP bridge blocks local-network abuse and disables redirects', () => {
  assert.match(
    functionText(networkSafety, 'assertAllowedHttpProtocol'),
    /HTTP request protocol is not allowed/,
  )
  assert.match(
    functionText(networkSafety, 'assertPublicHttpUrl'),
    /HTTP request target is not allowed/,
  )
  assert.match(functionText(networkSafety, 'assertPublicHttpRequestUrl'), /lookup\(url\.hostname/)
  assert.match(
    functionText(networkSafety, 'assertPublicHttpRequestUrl'),
    /resolved to a blocked address/,
  )
  assert.match(http.text, /assertPublicHttpRequestUrl/)
  assert.match(http.text, /maxRedirects: 0/)
  assert.match(http.text, /normalizeOllamaBaseUrl/)
  assert.match(http.text, /normalizeLingvaBaseUrl/)
  assert.match(http.text, /normalizeGoogleTranslateBaseUrl/)
  assert.match(http.text, /normalizeDeepLXEndpointUrl/)
  assert.match(http.text, /getServiceName/)
  assert.match(http.text, /ServiceSourceType\.BUILDIN/)
  assert.doesNotMatch(functionText(http, 'configuredProviderOrigins'), /split\('@'\)/)
  assert.match(functionText(http, 'configuredProviderOrigins'), /normalizeOllamaBaseUrl/)
  assert.match(
    functionText(http, 'configuredProviderOrigins'),
    /serviceName === 'deepl'[\s\S]*normalizeDeepLServiceType\(providerConfig\.type\) === 'deeplx'/,
  )
  assert.match(
    functionText(http, 'configuredProviderOrigins'),
    /getDeepLXCustomUrl\(providerConfig\)/,
  )
  assert.match(functionText(http, 'configuredProviderOrigins'), /serviceName === 'lingva'/)
  assert.match(functionText(http, 'configuredProviderOrigins'), /normalizeLingvaBaseUrl/)
  assert.match(functionText(http, 'configuredProviderOrigins'), /serviceName === 'google'/)
  assert.match(functionText(http, 'isConfiguredPrivateProviderTarget'), /isBlockedNetworkAddress/)
  assert.match(functionText(http, 'isConfiguredPrivateProviderTarget'), /configuredProviderOrigins/)
  assert.match(http.text, /import \{ net \} from 'electron'/)
  assert.match(functionText(http, 'streamRequest'), /assertAllowedProviderRequestUrl/)
  assert.match(functionText(http, 'streamRequest'), /redirect: 'manual'/)
})

test('plugin binary execution is relative to the installed plugin directory and uses execFile', () => {
  assert.match(pluginBinary.text, /import \{ execFile \} from 'node:child_process'/)
  assert.match(functionText(pluginBinary, 'resolveBinaryPath'), /path\.isAbsolute\(cmdName\)/)
  assert.match(functionText(pluginBinary, 'resolveBinaryPath'), /part\) => part === '\.\.'/)
  assert.match(
    functionText(pluginBinary, 'resolveBinaryPath'),
    /assertInside\(pluginDir, candidate\)/,
  )
  assert.match(
    functionText(pluginBinary, 'runPluginBinary'),
    /execFileAsync\(binaryPath, normalizeArgs/,
  )
  assert.match(functionText(pluginBinary, 'runPluginBinary'), /cwd: pluginDir/)
  assert.match(functionText(pluginBinary, 'runPluginBinary'), /windowsHide: true/)
})

test('plugin runtime sandbox exposes only explicit utils RPC and checks message origin by frame', () => {
  assert.match(functionText(pluginRuntime, 'createSandbox'), /document\.createElement\('iframe'\)/)
  assert.match(
    functionText(pluginRuntime, 'createSandbox'),
    /frame\.sandbox\.add\('allow-scripts'\)/,
  )
  assert.doesNotMatch(functionText(pluginRuntime, 'createSandbox'), /allow-same-origin/)
  assert.match(functionText(pluginRuntime, 'attachMessageListener'), /event\.source/)
  assert.match(functionText(pluginRuntime, 'handleSandboxRequest'), /case 'httpFetch'/)
  assert.match(functionText(pluginRuntime, 'handleSandboxRequest'), /case 'readFile'/)
  assert.match(functionText(pluginRuntime, 'handleSandboxRequest'), /case 'run'/)
  assert.match(functionText(pluginRuntime, 'handleSandboxRequest'), /case 'openUrl'/)
  assert.match(functionText(pluginRuntime, 'sandboxHtml'), /__neopot_utils/)
  assert.match(functionText(pluginRuntime, 'sandboxHtml'), /URL\.createObjectURL\(new Blob/)
  assert.match(functionText(pluginRuntime, 'getPluginRuntime'), /baseDir: BaseDirectory\.AppConfig/)
})
