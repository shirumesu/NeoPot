import assert from 'node:assert/strict'
import test from 'node:test'

import { functionText, parseSource, read } from '../shared/source.mjs'

const server = parseSource('src', 'main', 'modules', 'localServer.ts')
const hotkey = parseSource('src', 'main', 'modules', 'hotkey.ts')
const tray = parseSource('src', 'main', 'modules', 'tray.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const screenshot = parseSource('src', 'main', 'modules', 'screenshot.ts')
const screenshotWindow = read('src', 'renderer', 'windows', 'Screenshot', 'index.tsx')
const rendererWindow = read('src', 'renderer', 'lib', 'electron', 'window.ts')
const generalSettings = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'General',
  'index.tsx',
)

test('core workflows are reachable from hotkey, local server, renderer IPC, and tray where applicable', () => {
  for (const workflowName of [
    'selectionTranslate',
    'inputTranslate',
    'ocrRecognize',
    'ocrTranslate',
  ]) {
    for (const [label, source] of [
      ['hotkey', hotkey.text],
      ['server', server.text],
      ['ipc', ipc.text],
    ]) {
      assert.match(
        source,
        new RegExp(`\\b${workflowName}\\b`),
        `${workflowName} missing from ${label}`,
      )
    }
  }

  const trayDispatcher = functionText(tray, 'dispatchTrayConfiguredAction')
  for (const action of ['config', 'translate', 'ocr_recognize', 'ocr_translate', 'disable']) {
    assert.match(
      generalSettings,
      new RegExp(`key="${action}"`),
      `settings missing tray action ${action}`,
    )
    assert.match(trayDispatcher, new RegExp(`case '${action}'`), `tray missing action ${action}`)
  }
})

test('screenshot flow keeps display scale metadata aligned across Main and renderer', () => {
  assert.match(ipc.text, /'app:get-current-display'/)
  assert.match(rendererWindow, /window\.neoPot\.app\.getCurrentDisplay/)
  assert.match(screenshotWindow, /const monitor = await appWindow\.getDisplay\(\)/)
  assert.match(
    functionText(screenshot, 'captureDisplayForPoint'),
    /lastScaleFactor = display\.scaleFactor/,
  )
  assert.match(functionText(screenshot, 'cropCapture'), /Math\.round\(rect\.x \* lastScaleFactor\)/)
  assert.match(
    functionText(screenshot, 'cropCapture'),
    /Math\.round\(rect\.width \* lastScaleFactor\)/,
  )
})
