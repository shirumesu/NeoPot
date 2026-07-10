import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSetEqual,
  collectNewSetStringLiterals,
  collectStringLiteralUnion,
  collectVariableObjectKeys,
  dirNames,
  functionText,
  objectPropertyText,
  parseSource,
  read,
  walkFiles,
} from '../shared/source.mjs'

const windowSource = parseSource('src', 'main', 'modules', 'window.ts')
const appSource = parseSource('src', 'renderer', 'App.tsx')
const dts = parseSource('src', 'shared', 'types', 'electron-api.d.ts')

const EXPECTED_LABELS = ['config', 'recognize', 'screenshot', 'translate', 'updater']
const EXPECTED_CONFIG_ROUTES = [
  '/about',
  '/general',
  '/hotkey',
  '/plugin',
  '/recognize',
  '/service',
  '/translate',
]

test('window labels are exact and synchronized across Main, shared types, and renderer routing', () => {
  assert.deepEqual(collectStringLiteralUnion(windowSource, 'WindowLabel'), EXPECTED_LABELS)
  assert.deepEqual(collectStringLiteralUnion(dts, 'WindowLabel'), EXPECTED_LABELS)
  assert.deepEqual(collectVariableObjectKeys(windowSource, 'windowDefinitions'), EXPECTED_LABELS)
  assert.deepEqual(collectVariableObjectKeys(appSource, 'windowMap'), EXPECTED_LABELS)
})

test('each window definition preserves the behavior that makes its desktop workflow usable', () => {
  const screenshotDefinition = objectPropertyText(windowSource, 'windowDefinitions', 'screenshot')
  assert.match(screenshotDefinition, /fullscreen:\s*true/)
  assert.match(screenshotDefinition, /transparent:\s*true/)
  assert.match(screenshotDefinition, /alwaysOnTop:\s*true/)
  assert.match(screenshotDefinition, /resizable:\s*false/)
  assert.match(screenshotDefinition, /skipTaskbar:\s*true/)

  const translateDefinition = objectPropertyText(windowSource, 'windowDefinitions', 'translate')
  assert.doesNotMatch(translateDefinition, /skipTaskbar:\s*true/)
  assert.match(translateDefinition, /transparent:\s*true/)
  assert.match(translateDefinition, /resizable:\s*true/)

  const configDefinition = objectPropertyText(windowSource, 'windowDefinitions', 'config')
  assert.match(configDefinition, /resizable:\s*true/)
  assert.match(configDefinition, /minWidth:\s*800/)
  assert.match(configDefinition, /minHeight:\s*400/)
})

test('BrowserWindow options keep renderer isolation, packaged preload path, and custom chrome intact', () => {
  const createWindow = functionText(windowSource, 'createBrowserWindow')

  assert.match(createWindow, /frame:\s*false/)
  assert.match(createWindow, /thickFrame:\s*true/)
  assert.match(createWindow, /preload: path\.join\(__dirname, '\.\.', 'preload', 'index\.cjs'\)/)
  assert.match(createWindow, /contextIsolation:\s*true/)
  assert.match(createWindow, /nodeIntegration:\s*false/)
  assert.match(createWindow, /sandbox:\s*true/)
  assert.match(createWindow, /webSecurity:\s*true/)
})

test('packaged renderer URLs ignore ELECTRON_RENDERER_URL outside dev mode and use neopot scheme', () => {
  assert.match(functionText(windowSource, 'shouldUseDevRendererUrl'), /!app\.isPackaged/)
  assert.match(
    functionText(windowSource, 'rendererUrl'),
    /new URL\(`\$\{RENDERER_SCHEME\}:\/\/\$\{RENDERER_HOST\}\/index\.html`\)/,
  )
  assert.doesNotMatch(
    functionText(windowSource, 'rendererUrl'),
    /if \(process\.env\.ELECTRON_RENDERER_URL\)/,
  )
  assert.match(
    functionText(windowSource, 'registerRendererProtocol'),
    /protocol\.handle\(RENDERER_SCHEME/,
  )
  assert.match(
    functionText(windowSource, 'registerRendererProtocol'),
    /resolveRendererFile\(request\.url, root\)/,
  )
})

test('desktop windows use stronger topmost level for explicit always-on-top behavior', () => {
  assert.match(windowSource.text, /window\.setAlwaysOnTop\(true, 'screen-saver'\)/)
})

test('translate window sizing and positioning respect adaptive, remembered-size, and remembered-position settings', () => {
  const adaptiveResize = functionText(windowSource, 'resizeTranslateWindowForText')
  assert.match(adaptiveResize, /translate_adaptive_window_size/)
  assert.match(adaptiveResize, /translate_remember_window_size/)
  assert.match(adaptiveResize, /calculateAdaptiveTranslateWindowSize/)
  assert.match(adaptiveResize, /window\.setSize\(size\.width, size\.height\)/)
  assert.match(adaptiveResize, /positionTranslateWindow\(window\)/)

  const rememberedPosition = functionText(windowSource, 'getRememberedTranslateWindowPosition')
  assert.match(rememberedPosition, /translate_window_position/)
  assert.match(rememberedPosition, /translate_window_position_x/)
  assert.match(rememberedPosition, /translate_window_position_y/)
  assert.match(rememberedPosition, /Math\.max\(bounds\.x, Math\.min\(storedX/)
  assert.match(rememberedPosition, /Math\.max\(bounds\.y, Math\.min\(storedY/)

  assert.match(
    functionText(windowSource, 'positionTranslateWindow'),
    /getRememberedTranslateWindowPosition/,
  )
})

test('config routes are exact and every route maps to a real page directory', () => {
  const routes = collectNewSetStringLiterals(appSource, 'configRoutes')
  assert.deepEqual(routes, EXPECTED_CONFIG_ROUTES)

  const pageDirs = dirNames('src', 'renderer', 'windows', 'Config', 'pages')
  for (const route of routes) {
    const pageDir = route.slice(1).replace(/^[a-z]/, (char) => char.toUpperCase())
    assert.ok(pageDirs.includes(pageDir), `route ${route} has no page directory ${pageDir}`)
  }

  assert.match(
    functionText(appSource, 'normalizeConfigRoute'),
    /return configRoutes\.has\(normalized\) \? normalized : '\/general'/,
  )
  assert.match(functionText(appSource, 'getInitialConfigRoute'), /window\.location\.hash/)
  assert.match(
    functionText(appSource, 'getInitialConfigRoute'),
    /new URLSearchParams\(window\.location\.search\)\.get\('page'\)/,
  )
})

test('renderer source no longer uses legacy tauri window event names', () => {
  const offenders = walkFiles('src').filter(
    (file) => /\.(ts|tsx)$/.test(file) && read(file).includes('tauri://'),
  )
  assert.deepEqual(offenders, [])
})

test('renderer app attaches plugin hotkeys and wraps every window in an ErrorBoundary', () => {
  assert.match(appSource.text, /attachPluginHotkeyListener\(\)/)
  assert.match(
    appSource.text,
    /window\.neoPot \? await window\.neoPot\.app\.getWindowLabel\(\) : appWindow\.label/,
  )
  assert.match(appSource.text, /<MemoryRouter/)
  assert.match(appSource.text, /<ErrorBoundary/)
  assert.match(appSource.text, /fallbackTitle=\{t\('errors\.window_render_failed'/)
  assertSetEqual(collectVariableObjectKeys(appSource, 'windowMap'), EXPECTED_LABELS)
})
