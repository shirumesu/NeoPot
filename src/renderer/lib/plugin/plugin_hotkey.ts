import { logger } from '../logger'
import { invoke_plugin_handler } from './invoke_plugin'

interface PluginHotkeyPayload {
  type: string
  name: string
  key: string
  handler: string
}

let unsubscribePluginHotkey: (() => void) | null = null

function parsePluginHotkeyPayload(payload: unknown): PluginHotkeyPayload | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const candidate = payload as Record<string, unknown>
  if (
    typeof candidate.type !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.key !== 'string' ||
    typeof candidate.handler !== 'string' ||
    candidate.type.length === 0 ||
    candidate.name.length === 0 ||
    candidate.key.length === 0 ||
    candidate.handler.trim().length === 0
  ) {
    return null
  }

  return {
    type: candidate.type,
    name: candidate.name,
    key: candidate.key,
    handler: candidate.handler.trim(),
  }
}

export function attachPluginHotkeyListener(): () => void {
  if (unsubscribePluginHotkey) {
    return unsubscribePluginHotkey
  }

  if (!window.neoPot?.app.onEvent) {
    return () => undefined
  }

  unsubscribePluginHotkey = window.neoPot.app.onEvent('plugin_hotkey_triggered', (payload) => {
    const hotkey = parsePluginHotkeyPayload(payload)
    if (!hotkey) {
      logger.warn('Ignored invalid plugin hotkey payload.', {
        payloadType: typeof payload,
      })
      return
    }

    void invoke_plugin_handler(hotkey.type, hotkey.name, hotkey.handler, {
      key: hotkey.key,
    }).catch((error) => {
      logger.error('Plugin hotkey handler failed.', error, {
        pluginType: hotkey.type,
        pluginName: hotkey.name,
        key: hotkey.key,
        handler: hotkey.handler,
      })
    })
  })

  return unsubscribePluginHotkey
}
