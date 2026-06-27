type HotkeyPlatform = 'Darwin' | string

type HotkeyKeyboardEvent = {
  code: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
}

const KEY_CODE_MAP: Record<string, string> = {
  AudioVolumeDown: 'VolumeDown',
  AudioVolumeMute: 'VolumeMute',
  AudioVolumeUp: 'VolumeUp',
  Backquote: '`',
  Backslash: '\\',
  Backspace: 'Backspace',
  BracketLeft: '[',
  BracketRight: ']',
  CapsLock: 'Capslock',
  Comma: ',',
  Delete: 'Delete',
  End: 'End',
  Enter: 'Enter',
  Equal: '=',
  Escape: 'Esc',
  Home: 'Home',
  Insert: 'Insert',
  IntlBackslash: '\\',
  IntlYen: '\\',
  MediaPlayPause: 'MediaPlayPause',
  MediaStop: 'MediaStop',
  MediaTrackNext: 'MediaNextTrack',
  MediaTrackPrevious: 'MediaPreviousTrack',
  Minus: '-',
  NumLock: 'Numlock',
  PageDown: 'PageDown',
  PageUp: 'PageUp',
  Pause: 'Pause',
  Period: '.',
  Plus: 'Plus',
  PrintScreen: 'PrintScreen',
  Quote: "'",
  ScrollLock: 'Scrolllock',
  Semicolon: ';',
  Slash: '/',
  Space: 'Space',
  Tab: 'Tab',
}

const NUMPAD_KEY_CODE_MAP: Record<string, string> = {
  Numpad0: 'num0',
  Numpad1: 'num1',
  Numpad2: 'num2',
  Numpad3: 'num3',
  Numpad4: 'num4',
  Numpad5: 'num5',
  Numpad6: 'num6',
  Numpad7: 'num7',
  Numpad8: 'num8',
  Numpad9: 'num9',
  NumpadAdd: 'numadd',
  NumpadComma: 'numdec',
  NumpadDecimal: 'numdec',
  NumpadDivide: 'numdiv',
  NumpadEnter: 'Enter',
  NumpadEqual: '=',
  NumpadMultiply: 'nummult',
  NumpadParenLeft: '(',
  NumpadParenRight: ')',
  NumpadSubtract: 'numsub',
}

function keyCodeFromEventCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) {
    return code.substring(3)
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.substring(5)
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code
  }

  if (code.startsWith('Numpad')) {
    return NUMPAD_KEY_CODE_MAP[code] ?? ''
  }

  if (code.startsWith('Arrow')) {
    const direction = code.substring(5)
    return ['Up', 'Down', 'Left', 'Right'].includes(direction) ? direction : ''
  }

  return KEY_CODE_MAP[code] ?? ''
}

export function shortcutFromKeyboardEvent(
  event: HotkeyKeyboardEvent,
  platform: HotkeyPlatform,
): string {
  const keyCode = keyCodeFromEventCode(event.code)
  if (!keyCode) {
    return ''
  }

  const modifiers: string[] = []
  if (event.ctrlKey) {
    modifiers.push('Ctrl')
  }
  if (event.shiftKey) {
    modifiers.push('Shift')
  }
  if (event.metaKey) {
    modifiers.push(platform === 'Darwin' ? 'Command' : 'Super')
  }
  if (event.altKey) {
    modifiers.push('Alt')
  }

  return [...modifiers, keyCode].join('+')
}
