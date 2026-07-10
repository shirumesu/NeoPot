import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSetEqual,
  collectSwitchCaseTexts,
  collectVariableObjectKeys,
  functionText,
  objectPropertyText,
  parseSource,
  read,
} from '../shared/source.mjs'

const server = parseSource('src', 'main', 'modules', 'localServer.ts')
const workflow = parseSource('src', 'main', 'modules', 'workflow.ts')
const hotkey = parseSource('src', 'main', 'modules', 'hotkey.ts')
const tray = parseSource('src', 'main', 'modules', 'tray.ts')
const ipc = parseSource('src', 'main', 'modules', 'ipc.ts')
const selection = parseSource('src', 'main', 'modules', 'selection.ts')
const clipboard = parseSource('src', 'main', 'modules', 'clipboard.ts')
const screenshot = parseSource('src', 'main', 'modules', 'screenshot.ts')
const screenshotWindow = read('src', 'renderer', 'windows', 'Screenshot', 'index.tsx')
const screenshotCompatWindow = read('src', 'renderer', 'lib', 'electron', 'compat', 'window.ts')
const sourceArea = read(
  'src',
  'renderer',
  'windows',
  'Translate',
  'components',
  'SourceArea',
  'index.tsx',
)
const targetArea = read(
  'src',
  'renderer',
  'windows',
  'Translate',
  'components',
  'TargetArea',
  'index.tsx',
)
const syncAtomHook = read('src', 'renderer', 'hooks', 'useSyncAtom.ts')
const generalSettings = read(
  'src',
  'renderer',
  'windows',
  'Config',
  'pages',
  'General',
  'index.tsx',
)

const CORE_WORKFLOWS = ['selectionTranslate', 'inputTranslate', 'ocrRecognize', 'ocrTranslate']

test('local HTTP server exposes the documented route matrix and no extra routes', () => {
  const cases = collectSwitchCaseTexts(server, 'handleRoute')
  assertSetEqual(
    [...cases.keys()],
    [
      '/',
      '/config',
      '/input_translate',
      '/ocr_recognize',
      '/ocr_translate',
      '/selection_translate',
      '/translate',
      'default',
    ],
  )
})

test('default global hotkeys map every core workflow to its handler', () => {
  assertSetEqual(collectVariableObjectKeys(hotkey, 'defaultShortcuts'), [
    'hotkey_input_translate',
    'hotkey_ocr_recognize',
    'hotkey_ocr_translate',
    'hotkey_selection_translate',
  ])

  const expected = {
    hotkey_selection_translate: 'selectionTranslate',
    hotkey_input_translate: 'inputTranslate',
    hotkey_ocr_recognize: 'ocrRecognize',
    hotkey_ocr_translate: 'ocrTranslate',
  }
  for (const [key, handler] of Object.entries(expected)) {
    assert.match(
      objectPropertyText(hotkey, 'defaultShortcuts', key),
      new RegExp(`handler:\\s*${handler}`),
    )
  }
})

test('plugin hotkeys are registered only when enabled manifest entries expose handlers', () => {
  assert.match(hotkey.text, /const PLUGIN_HOTKEY_PREFIX = 'plugin_hotkey:'/)
  assert.match(functionText(hotkey, 'parsePluginHotkeyName'), /name\.split\(':'\)/)
  assert.match(functionText(hotkey, 'handlePluginHotkey'), /getInstalledPluginHotkey/)
  assert.match(
    functionText(hotkey, 'handlePluginHotkey'),
    /sendToPreferredWindow\('config', 'plugin_hotkey_triggered'/,
  )
  assert.match(functionText(hotkey, 'registerInstalledPluginShortcuts'), /listInstalledPlugins\(\)/)
  assert.match(
    functionText(hotkey, 'registerInstalledPluginShortcuts'),
    /typeof handler !== 'string' \|\| !handler\.trim\(\)/,
  )
})

test('core workflows are reachable from hotkey, local server, renderer IPC, and tray where applicable', () => {
  const sources = {
    hotkey: hotkey.text,
    server: server.text,
    ipc: ipc.text,
  }

  for (const workflowName of CORE_WORKFLOWS) {
    for (const [label, source] of Object.entries(sources)) {
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
  assert.match(trayDispatcher, /case 'translate':[\s\S]*openTranslate\(\)/)
  assert.match(trayDispatcher, /case 'ocr_recognize':[\s\S]*ocrRecognize\(\)/)
  assert.match(trayDispatcher, /case 'ocr_translate':[\s\S]*ocrTranslate\(\)/)
  assert.match(trayDispatcher, /case 'disable':[\s\S]*break/)
})

test('workflow state updates send the renderer events that drive translate, OCR, and screenshot windows', () => {
  assert.match(functionText(workflow, 'sendTranslateWorkflow'), /currentWorkflowText = text/)
  assert.match(functionText(workflow, 'sendTranslateWorkflow'), /openWindow\('translate'\)/)
  assert.match(
    functionText(workflow, 'sendTranslateWorkflow'),
    /sendToWindow\('translate', 'new_text', payload\)/,
  )
  assert.match(functionText(workflow, 'textTranslate'), /kind: 'text'/)
  assert.match(functionText(workflow, 'inputTranslate'), /kind: 'input'/)
  assert.match(functionText(workflow, 'imageTranslate'), /kind: 'image'/)

  assert.match(functionText(workflow, 'recognizeWindow'), /currentWorkflowText = ''/)
  assert.match(functionText(workflow, 'recognizeWindow'), /openWindow\('recognize'\)/)
  assert.match(
    functionText(workflow, 'recognizeWindow'),
    /sendToWindow\('recognize', 'new_image', ''\)/,
  )

  assert.match(functionText(workflow, 'ocrRecognize'), /currentScreenshotAction = 'recognize'/)
  assert.match(
    functionText(workflow, 'ocrRecognize'),
    /sendToWindow\('screenshot', 'capture_screenshot', 'recognize'\)/,
  )
  assert.match(functionText(workflow, 'ocrTranslate'), /currentScreenshotAction = 'translate'/)
  assert.match(
    functionText(workflow, 'ocrTranslate'),
    /sendToWindow\('screenshot', 'capture_screenshot', 'translate'\)/,
  )
})

test('selection translation is serialized and does not let clipboard monitoring re-enter', () => {
  assert.match(workflow.text, /let selectionTranslateInFlight: Promise<void> \| null = null/)
  assert.match(functionText(workflow, 'selectionTranslate'), /if \(selectionTranslateInFlight\)/)
  assert.match(
    functionText(workflow, 'runSelectionTranslate'),
    /const capture = await readSelectedText\(\)/,
  )
  assert.match(functionText(workflow, 'runSelectionTranslate'), /kind: 'selection'/)
  assert.match(functionText(workflow, 'runSelectionTranslate'), /\bcapture\b/)
  assert.match(selection.text, /selectionClipboardCaptureDepth \+= 1/)
  assert.match(selection.text, /selectionClipboardBaselineVersion \+= 1/)
  assert.match(
    functionText(clipboard, 'startClipboardMonitor'),
    /isSelectionClipboardCaptureActive\(\) \|\| syncSelectionClipboardBaseline\(\)/,
  )
})

test('selection capture uses platform copy fallbacks and restores only operation-owned clipboard values', () => {
  assert.match(functionText(selection, 'readLinuxPrimarySelection'), /'wl-paste'/)
  assert.match(functionText(selection, 'readLinuxPrimarySelection'), /'xclip'/)
  assert.match(functionText(selection, 'readLinuxPrimarySelection'), /'xsel'/)
  assert.match(functionText(selection, 'sendLinuxCopyKeystroke'), /'xdotool'/)
  assert.match(functionText(selection, 'sendLinuxCopyKeystroke'), /'wtype'/)
  assert.match(functionText(selection, 'sendMacCopyKeystroke'), /'osascript'/)
  assert.match(functionText(selection, 'sendWindowsCopyKeystroke'), /powershell\.exe/)
  assert.match(selection.text, /COPY_SETTLE_DELAY_MS/)
  assert.match(selection.text, /COPY_ATTEMPT_COUNT = 2/)
  assert.match(selection.text, /UIAutomationClient/)
  assert.match(
    functionText(selection, 'readWindowsUiaSelectedText'),
    /WINDOWS_UIA_SELECTION_COMMAND/,
  )
  assert.match(functionText(selection, 'readWindowsUiaSelection'), /readWindowsUiaSelectedText\(\)/)
  assert.match(functionText(selection, 'readWindowsUiaSelection'), /windows-uia-selection/)
  assert.match(
    functionText(selection, 'readWindowsSelectedText'),
    /const uiaSelection = readWindowsUiaSelection\(\)/,
  )
  assert.match(
    functionText(selection, 'readWindowsSelectedText'),
    /const clipboardFallback = readClipboardFallbackSelection/,
  )
  assert.match(
    functionText(selection, 'readWindowsSelectedText'),
    /Promise\.race\(\[uiaSelection, clipboardFallback\]\)/,
  )
  assert.match(
    functionText(selection, 'readSelectedText'),
    /case 'linux':[\s\S]*readLinuxSelectedText\(\)/,
  )
  assert.match(
    functionText(selection, 'readSelectedText'),
    /case 'win32':[\s\S]*readWindowsSelectedText\(\)/,
  )
  assert.match(
    functionText(selection, 'readSelectedText'),
    /case 'darwin':[\s\S]*readMacSelectedText\(\)/,
  )
  assert.match(functionText(selection, 'readLinuxSelectedText'), /linux-primary-selection/)
  assert.match(functionText(selection, 'readLinuxSelectedText'), /linux-clipboard-fallback/)
  assert.match(functionText(selection, 'readClipboardFallbackSelection'), /for \(let attempt = 0/)
  assert.match(functionText(selection, 'readClipboardFallbackSelection'), /currentText === marker/)
  assert.match(
    functionText(selection, 'readClipboardFallbackSelection'),
    /copiedClipboardValue !== null && currentText === copiedClipboardValue/,
  )
})

test('screenshot flow uses Main display scale metadata through the renderer bridge', () => {
  assert.match(ipc.text, /'app:get-current-display'/)
  assert.match(screenshotCompatWindow, /window\.neoPot\?\.app\?\.getCurrentDisplay/)
  assert.match(screenshotWindow, /const monitor = await currentMonitor\(\)/)
  assert.match(screenshotWindow, /x: position\.x/)
  assert.match(screenshotWindow, /y: position\.y/)
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

test('empty translation workflow text is a real clear operation that invalidates stale translations', () => {
  assert.match(sourceArea, /toTranslateWorkflowPayload\(payload\)/)
  assert.match(sourceArea, /workflowTextVersionRef\.current \+= 1/)
  assert.match(sourceArea, /setSourceText\('', true\)/)
  assert.match(sourceArea, /syncSourceText\(''\)/)
  assert.match(sourceArea, /showSelectionCaptureNotice/)
  assert.match(syncAtomHook, /forceSync\?: boolean/)
  assert.match(syncAtomHook, /setAtomValue\(nextValue as T\)/)
  assert.match(targetArea, /const canTranslate =/)
  assert.match(targetArea, /translateID\[index\] = ''/)
  assert.match(targetArea, /setIsLoading\(false\)/)
})
