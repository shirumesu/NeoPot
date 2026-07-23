import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectNewSetStringLiterals,
  collectStringLiteralUnion,
  collectVariableObjectKeys,
  dirNames,
  parseSource,
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

test('window labels stay synchronized across Main, shared types, and renderer routing', () => {
  assert.deepEqual(collectStringLiteralUnion(windowSource, 'WindowLabel'), EXPECTED_LABELS)
  assert.deepEqual(collectStringLiteralUnion(dts, 'WindowLabel'), EXPECTED_LABELS)
  assert.deepEqual(collectVariableObjectKeys(windowSource, 'windowDefinitions'), EXPECTED_LABELS)
  assert.deepEqual(collectVariableObjectKeys(appSource, 'windowMap'), EXPECTED_LABELS)
})

test('config routes stay synchronized with their renderer page directories', () => {
  const routes = collectNewSetStringLiterals(appSource, 'configRoutes')
  assert.deepEqual(routes, EXPECTED_CONFIG_ROUTES)

  const pageDirs = dirNames('src', 'renderer', 'windows', 'Config', 'pages')
  for (const route of routes) {
    const pageDir = route.slice(1).replace(/^[a-z]/, (char) => char.toUpperCase())
    assert.ok(pageDirs.includes(pageDir), `route ${route} has no page directory ${pageDir}`)
  }
})
