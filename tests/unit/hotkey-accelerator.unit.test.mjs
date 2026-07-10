import assert from 'node:assert/strict'
import { test } from 'vitest'

import { shortcutFromKeyboardEvent } from '../../src/shared/hotkeyAccelerator.ts'

function keyEvent(code, modifiers = {}) {
  return {
    code,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers,
  }
}

test('hotkey accelerator mapping emits Electron numpad accelerator names', () => {
  const expected = {
    Numpad0: 'num0',
    Numpad9: 'num9',
    NumpadAdd: 'numadd',
    NumpadComma: 'numdec',
    NumpadDecimal: 'numdec',
    NumpadDivide: 'numdiv',
    NumpadEnter: 'Enter',
    NumpadEqual: '=',
    NumpadMultiply: 'nummult',
    NumpadSubtract: 'numsub',
  }

  for (const [code, accelerator] of Object.entries(expected)) {
    assert.equal(shortcutFromKeyboardEvent(keyEvent(code), 'Windows_NT'), accelerator)
  }
})

test('hotkey accelerator mapping combines modifiers with supported key codes', () => {
  assert.equal(
    shortcutFromKeyboardEvent(
      keyEvent('NumpadMultiply', {
        ctrlKey: true,
        shiftKey: true,
      }),
      'Windows_NT',
    ),
    'Ctrl+Shift+nummult',
  )
  assert.equal(
    shortcutFromKeyboardEvent(
      keyEvent('KeyK', {
        metaKey: true,
        altKey: true,
      }),
      'Darwin',
    ),
    'Command+Alt+K',
  )
  assert.equal(
    shortcutFromKeyboardEvent(
      keyEvent('KeyK', {
        metaKey: true,
        altKey: true,
      }),
      'Windows_NT',
    ),
    'Super+Alt+K',
  )
})

test('hotkey accelerator mapping keeps supported special keys valid', () => {
  const expected = {
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    AudioVolumeMute: 'VolumeMute',
    Backslash: '\\',
    Enter: 'Enter',
    IntlBackslash: '\\',
    IntlYen: '\\',
    MediaTrackNext: 'MediaNextTrack',
    NumLock: 'Numlock',
    PageDown: 'PageDown',
    PrintScreen: 'PrintScreen',
  }

  for (const [code, accelerator] of Object.entries(expected)) {
    assert.equal(shortcutFromKeyboardEvent(keyEvent(code), 'Windows_NT'), accelerator)
  }
})

test('hotkey accelerator mapping rejects modifier-only and unsupported codes', () => {
  assert.equal(
    shortcutFromKeyboardEvent(
      keyEvent('ControlLeft', {
        ctrlKey: true,
      }),
      'Windows_NT',
    ),
    '',
  )
  assert.equal(shortcutFromKeyboardEvent(keyEvent('NumpadMemoryClear'), 'Windows_NT'), '')
  assert.equal(shortcutFromKeyboardEvent(keyEvent('F25'), 'Windows_NT'), '')
})
