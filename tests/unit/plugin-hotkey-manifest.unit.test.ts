import { describe, expect, it } from 'vitest'

import {
  createPluginHotkeyRows,
  isPluginManifestHotkey,
} from '../../src/renderer/lib/plugin/pluginHotkeyManifest'

describe('plugin hotkey manifest normalization', () => {
  it('keeps valid hotkeys and attaches their plugin identity to editor rows', () => {
    expect(
      createPluginHotkeyRows({
        id: 'plugin-id',
        type: 'translate',
        name: 'example',
        display: 'Example Plugin',
        hotkeys: [
          {
            key: 'translate-selection',
            display: 'Translate selection',
            default: 'Alt+X',
            handler: 'translateSelection',
          },
          {
            key: 'missing-handler',
            display: 'Invalid',
            default: 'Alt+Y',
            handler: '  ',
          },
          null,
        ],
      }),
    ).toEqual([
      {
        pluginId: 'plugin-id',
        pluginType: 'translate',
        pluginName: 'example',
        pluginDisplay: 'Example Plugin',
        key: 'translate-selection',
        display: 'Translate selection',
        hotkey: 'Alt+X',
      },
    ])
  })

  it('rejects malformed hotkey fields instead of accepting partial manifests', () => {
    expect(
      isPluginManifestHotkey({
        key: 'translate-selection',
        display: 'Translate selection',
        default: 1,
        handler: 'translateSelection',
      }),
    ).toBe(false)
    expect(isPluginManifestHotkey(null)).toBe(false)
  })
})
