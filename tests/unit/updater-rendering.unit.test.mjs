import assert from 'node:assert/strict'
import { test } from 'vitest'

import { normalizeRequiredString } from '../../src/renderer/providers/translate/deepl/normalize.ts'
import {
  formatBytes,
  formatBytesPerSecond,
  getProgressPercent,
} from '../../src/renderer/windows/Updater/formatProgress.ts'
import { looksLikeHtmlReleaseNotes } from '../../src/renderer/windows/Updater/releaseNotes.ts'
import { getUpdatePrimaryAction } from '../../src/renderer/windows/Updater/updateActions.ts'

test('update progress formatting clamps percent and renders byte units predictably', () => {
  assert.equal(formatBytes(undefined), null)
  assert.equal(formatBytes(-1), null)
  assert.equal(formatBytes(Number.NaN), null)
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(999), '999 B')
  assert.equal(formatBytes(1024), '1 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB')
  assert.equal(formatBytesPerSecond(2048), '2 KB/s')

  assert.equal(getProgressPercent(null), undefined)
  assert.equal(getProgressPercent({ percent: Number.NaN }), undefined)
  assert.equal(getProgressPercent({ percent: -12 }), 0)
  assert.equal(getProgressPercent({ percent: 45.5 }), 45.5)
  assert.equal(getProgressPercent({ percent: 125 }), 100)
})

test('update primary action reflects result status, distribution mode, and restart readiness', () => {
  assert.equal(getUpdatePrimaryAction(null, false), 'check')
  assert.equal(getUpdatePrimaryAction({ status: 'error' }, false), 'check')
  assert.equal(getUpdatePrimaryAction({ status: 'not-available' }, false), 'check')
  assert.equal(getUpdatePrimaryAction({ status: 'unsupported' }, false), 'open-release-page')
  assert.equal(
    getUpdatePrimaryAction({ status: 'available', mode: 'manual-download' }, false),
    'open-release-page',
  )
  assert.equal(
    getUpdatePrimaryAction({ status: 'available', mode: 'self-update' }, false),
    'download',
  )
  assert.equal(
    getUpdatePrimaryAction({ status: 'available', mode: 'self-update' }, true),
    'install',
  )
})

test('release note normalization keeps plain markdown untouched', () => {
  const markdown = '## Changes\n\n- Added updater window'
  assert.equal(looksLikeHtmlReleaseNotes(markdown), false)
  assert.equal(looksLikeHtmlReleaseNotes('<h2>Changes</h2>'), true)
})

test('provider config normalization rejects missing required DeepL strings and trims valid input', () => {
  assert.equal(normalizeRequiredString('  auth-key  ', 'Auth key'), 'auth-key')
  for (const value of ['', '   ', null, undefined, 42]) {
    assert.throws(() => normalizeRequiredString(value, 'Auth key'), /Auth key is not configured/)
  }
})
