import assert from 'node:assert/strict'
import { test } from 'vitest'

import { toTranslateWorkflowPayload } from '../../src/shared/translateWorkflow.ts'

test('translate workflow payload parser keeps plain text and legacy command strings distinct', () => {
  assert.deepEqual(toTranslateWorkflowPayload('hello'), {
    kind: 'text',
    text: 'hello',
  })
  assert.deepEqual(toTranslateWorkflowPayload('[INPUT_TRANSLATE]'), {
    kind: 'input',
  })
  assert.deepEqual(toTranslateWorkflowPayload('[IMAGE_TRANSLATE]'), {
    kind: 'image',
  })
})

test('translate workflow payload parser preserves structured selection capture results', () => {
  assert.deepEqual(
    toTranslateWorkflowPayload({
      kind: 'selection',
      capture: {
        ok: true,
        text: 'selected text',
        method: 'linux-primary-selection',
      },
    }),
    {
      kind: 'selection',
      capture: {
        ok: true,
        text: 'selected text',
        method: 'linux-primary-selection',
      },
    },
  )

  assert.deepEqual(
    toTranslateWorkflowPayload({
      kind: 'selection',
      capture: {
        ok: false,
        reason: 'copy-timeout',
        method: 'windows-clipboard-fallback',
      },
    }),
    {
      kind: 'selection',
      capture: {
        ok: false,
        reason: 'copy-timeout',
        method: 'windows-clipboard-fallback',
      },
    },
  )

  assert.deepEqual(
    toTranslateWorkflowPayload({
      kind: 'selection',
      capture: {
        ok: true,
        text: 'browser selection',
        method: 'windows-uia-selection',
      },
    }),
    {
      kind: 'selection',
      capture: {
        ok: true,
        text: 'browser selection',
        method: 'windows-uia-selection',
      },
    },
  )
})

test('translate workflow payload parser rejects malformed payloads as empty text', () => {
  assert.deepEqual(toTranslateWorkflowPayload({ kind: 'selection', capture: { ok: true } }), {
    kind: 'text',
    text: '',
  })
  assert.deepEqual(toTranslateWorkflowPayload({ kind: 'unknown', text: 'ignored' }), {
    kind: 'text',
    text: '',
  })
})
