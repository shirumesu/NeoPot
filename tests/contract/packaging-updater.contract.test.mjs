import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertTextOrder,
  exists,
  functionText,
  parseSource,
  read,
  readJson,
} from '../shared/source.mjs'

const packageJson = readJson('package.json')
const electronVite = read('electron.vite.config.ts')
const builder = read('electron-builder.yml')
const mainIndex = parseSource('src', 'main', 'index.ts')
const windowSource = parseSource('src', 'main', 'modules', 'window.ts')
const updater = parseSource('src', 'main', 'modules', 'updater.ts')
const localOcrProvider = read(
  'src',
  'renderer',
  'providers',
  'recognize',
  'local_model',
  'index.tsx',
)

test('legacy Forge and split Vite build files stay removed from the active build path', () => {
  for (const removedPath of [
    ['forge.config.ts'],
    ['vite.main.config.ts'],
    ['vite.preload.config.ts'],
    ['vite.renderer.config.ts'],
    ['.scripts', 'dev.mjs'],
    ['.scripts', 'prepare-electron-winstaller.mjs'],
    ['.scripts', 'pack-plugins.mjs'],
  ]) {
    assert.equal(exists(...removedPath), false, removedPath.join('/'))
  }
})

test('package scripts use electron-vite/electron-builder and clean release output before packaging', () => {
  assert.match(packageJson.scripts.dev, /^electron-vite dev$/)
  assert.match(packageJson.scripts.build, /^electron-vite build$/)
  assert.match(packageJson.scripts.make, /clean-release-output\.mjs/)
  assert.match(packageJson.scripts.make, /electron-vite build/)
  assert.match(packageJson.scripts.make, /electron-builder --win --publish never/)
  assert.match(packageJson.scripts.release, /check-release-version\.mjs/)
  assert.match(packageJson.scripts.release, /clean-release-output\.mjs/)
  assert.match(packageJson.scripts.release, /electron-builder --publish always/)
  assert.doesNotMatch(packageJson.scripts.make, /pnpm run plugins/)
  assert.equal(Object.hasOwn(packageJson.scripts, 'plugins'), false)
})

test('electron-vite output paths stay aligned with runtime main/preload/renderer loading', () => {
  assert.match(electronVite, /outDir: 'out\/main'/)
  assert.match(electronVite, /outDir: 'out\/preload'/)
  assert.match(electronVite, /outDir: 'out\/renderer'/)
  assert.match(electronVite, /entryFileNames: '\[name\]\.cjs'/)
  assert.match(electronVite, /entryFileNames: 'index\.cjs'/)
  assert.match(electronVite, /@vitejs\/plugin-react/)
  assert.match(
    functionText(windowSource, 'getRendererRoot'),
    /path\.join\(__dirname, '\.\.', 'renderer'\)/,
  )
  assert.match(
    functionText(windowSource, 'createBrowserWindow'),
    /path\.join\(__dirname, '\.\.', 'preload', 'index\.cjs'\)/,
  )
  assert.match(functionText(windowSource, 'rendererUrl'), /RENDERER_SCHEME/)
})

test('main process startup order registers core services before user workflows run', () => {
  const startApp = functionText(mainIndex, 'startApp')

  assert.match(startApp, /Promise\.all\(\[/)
  assert.match(startApp, /ipc\.registerIpcHandlers/)
  assert.match(startApp, /windowModule\.registerRendererProtocol\(\)/)
  assert.match(startApp, /await config\.initializeConfig\(\)/)
  assert.match(startApp, /await windowModule\.openWindow\('config'\)/)
  assert.match(startApp, /tray\.setupTray\(\)/)
  assert.match(startApp, /hotkey\.registerGlobalShortcuts\('all'\)/)
  assert.match(startApp, /await proxy\.applyProxyToSession\(\)/)
  assert.match(startApp, /clipboard\.startClipboardMonitor\(\)/)
  assert.match(startApp, /server\.startServer\(serverPort\)/)
  assert.match(startApp, /updater\.runStartupUpdateCheck\(\)/)
  assert.match(startApp, /hotkey\.unregisterGlobalShortcuts\(\)/)
  assert.match(startApp, /server\.stopServer\(\)/)
  assertTextOrder(
    startApp,
    [
      'windowModule.registerRendererProtocol()',
      'await config.initializeConfig()',
      "await windowModule.openWindow('config')",
      'tray.setupTray()',
      "hotkey.registerGlobalShortcuts('all')",
      'await proxy.applyProxyToSession()',
      'clipboard.startClipboardMonitor()',
      'server.startServer(serverPort)',
      'void updater.runStartupUpdateCheck()',
    ],
    'Main startup services must initialize in dependency order',
  )
})

test('electron-builder package includes only the runtime outputs and expected Windows/Linux targets', () => {
  for (const included of [
    'out/main/**',
    'out/preload/**',
    'out/renderer/**',
    'public/**',
    'package.json',
  ]) {
    assert.match(builder, new RegExp(included.replaceAll('*', '\\*')))
  }

  for (const excluded of ['!node_modules/**', '!out/package/**', '!dist/**']) {
    assert.match(builder, new RegExp(excluded.replace(/[!*]/g, (char) => `\\${char}`)))
  }

  assert.match(builder, /asar:\s*true/)
  assert.match(builder, /\*\*\/\*\.node/)
  assert.match(builder, /provider: github/)
  assert.match(builder, /owner: shirumesu/)
  assert.match(builder, /repo: NeoPot/)
  assert.match(builder, /target: nsis/)
  assert.match(builder, /target: portable/)
  assert.match(builder, /target: AppImage/)
  assert.match(builder, /target: deb/)
  assert.match(builder, /target: rpm/)
  assert.match(builder, /NeoPot-Setup-\$\{version\}\.\$\{ext\}/)
  assert.match(builder, /NeoPot-\$\{version\}-portable-\$\{arch\}\.\$\{ext\}/)
})

test('OCR runtime assets are bundled into renderer output and fetched from a non-file origin', () => {
  assert.match(builder, /out\/renderer\/\*\*/)
  assert.match(localOcrProvider, /PP-OCRv5_mobile_det_onnx\.tar\?url/)
  assert.match(localOcrProvider, /PP-OCRv5_mobile_rec_onnx\.tar\?url/)
  assert.match(localOcrProvider, /ort-wasm-simd-threaded\.jsep\.wasm\?url/)
  assert.match(localOcrProvider, /wasmPaths:\s*\{\s*wasm:\s*ortWasmUrl,?\s*\}/)
  assert.match(functionText(windowSource, 'rendererUrl'), /neopot/)
  assert.doesNotMatch(functionText(windowSource, 'rendererUrl'), /file:\/\//)
})

test('updater distribution mode separates self-update builds from manual-download builds', () => {
  const distribution = functionText(updater, 'getDistributionMode')

  assert.match(distribution, /!app\.isPackaged/)
  assert.match(distribution, /process\.platform === 'linux'/)
  assert.match(distribution, /process\.env\.APPIMAGE/)
  assert.match(distribution, /distribution: 'appimage', mode: 'self-update'/)
  assert.match(distribution, /distribution: 'deb-rpm', mode: 'manual-download'/)
  assert.match(distribution, /process\.platform === 'win32'/)
  assert.match(distribution, /Uninstall \$\{app\.getName\(\)\}\.exe/)
  assert.match(distribution, /distribution: 'installer', mode: 'self-update'/)
  assert.match(distribution, /distribution: 'portable', mode: 'manual-download'/)
})

test('updater checks filter GitHub releases by semver and prerelease compatibility', () => {
  assert.match(
    updater.text,
    /const githubApiBaseUrl = 'https:\/\/api\.github\.com\/repos\/shirumesu\/NeoPot\/releases'/,
  )
  assert.match(functionText(updater, 'getReleaseVersion'), /stripVersionPrefix/)
  assert.match(functionText(updater, 'getReleaseVersion'), /isSemanticVersion/)
  assert.match(
    functionText(updater, 'fetchGithubRelease'),
    /const allowPrerelease = isPrereleaseVersion\(currentVersion\)/,
  )
  assert.match(functionText(updater, 'fetchGithubRelease'), /release\.prerelease !== true/)
  assert.match(functionText(updater, 'fetchGithubRelease'), /compareVersions/)
  assert.match(
    functionText(updater, 'checkGithubRelease'),
    /latestReleasePageUrl = resultBase\.releasePageUrl/,
  )
  assert.match(
    functionText(updater, 'checkGithubRelease'),
    /compareVersions\(releaseVersion, app\.getVersion\(\)\) > 0/,
  )
})

test('updater event flow publishes progress, downloaded, install, and startup notification events', () => {
  assert.match(functionText(updater, 'publishEvent'), /webContents\.send\('update:event', event\)/)
  assert.match(functionText(updater, 'attachAutoUpdaterListeners'), /'download-progress'/)
  assert.match(
    functionText(updater, 'attachAutoUpdaterListeners'),
    /bytesPerSecond: progress\.bytesPerSecond/,
  )
  assert.match(
    functionText(updater, 'attachAutoUpdaterListeners'),
    /publishEvent\(\{ type: 'downloaded', result \}\)/,
  )
  assert.match(functionText(updater, 'install'), /publishEvent\(\{ type: 'installing' \}\)/)
  assert.match(functionText(updater, 'showStartupNotification'), /result\.status !== 'available'/)
  assert.match(functionText(updater, 'showStartupNotification'), /openUpdaterNotification\(\)/)
  assert.match(
    functionText(updater, 'showStartupNotification'),
    /sendToWindow\('updater', 'startup_update_available', result\)/,
  )
})

test('manual update paths open the pinned GitHub release page instead of attempting unsupported self-update', () => {
  assert.match(functionText(updater, 'download'), /mode\.mode !== 'self-update'/)
  assert.match(functionText(updater, 'download'), /await openReleasePage\(\)/)
  assert.match(functionText(updater, 'install'), /mode\.mode !== 'self-update'/)
  assert.match(functionText(updater, 'install'), /void openReleasePage\(\)/)
  assert.match(functionText(updater, 'openReleasePage'), /allowedHosts: \['github\.com'\]/)
  assert.match(functionText(updater, 'openReleasePage'), /allowedProtocols: \['https:'\]/)
  assert.match(functionText(updater, 'openReleasePage'), /allowSubdomains: false/)
})
