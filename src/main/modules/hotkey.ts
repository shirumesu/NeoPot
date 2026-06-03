import { globalShortcut, shell } from 'electron'
import { logger } from '../logger'
import { inputTranslate, ocrRecognize, ocrTranslate, selectionTranslate } from './workflow'
import { getConfig, setConfig } from './config'
import { getInstalledPluginHotkey, listInstalledPlugins } from '../plugins/installer'

const defaultShortcuts: Record<string, { handler: () => void | Promise<void> }> = {
  hotkey_selection_translate: {
    handler: selectionTranslate,
  },
  hotkey_input_translate: {
    handler: inputTranslate,
  },
  hotkey_ocr_recognize: {
    handler: ocrRecognize,
  },
  hotkey_ocr_translate: {
    handler: ocrTranslate,
  },
}

const PLUGIN_HOTKEY_PREFIX = 'plugin_hotkey:'

function parsePluginHotkeyName(name: string): {
  type: string
  pluginName: string
  key: string
} | null {
  if (!name.startsWith(PLUGIN_HOTKEY_PREFIX)) {
    return null
  }

  const [, type, pluginName, ...keyParts] = name.split(':')
  const key = keyParts.join(':')
  if (!type || !pluginName || !key) {
    return null
  }

  return { type, pluginName, key }
}

function getHotkeyOpenUrl(hotkey: Record<string, unknown>): string {
  if (typeof hotkey.url === 'string') {
    return hotkey.url
  }

  const action = hotkey.action
  if (typeof action === 'object' && action !== null) {
    const actionRecord = action as Record<string, unknown>
    if (actionRecord.type === 'open_url' && typeof actionRecord.url === 'string') {
      return actionRecord.url
    }
  }

  return ''
}

async function handlePluginHotkey(name: string): Promise<void> {
  const identity = parsePluginHotkeyName(name)
  if (!identity) {
    return
  }

  const hotkey = await getInstalledPluginHotkey(identity.type, identity.pluginName, identity.key)
  if (!hotkey) {
    logger.warn('Plugin hotkey manifest entry was not found.', {
      name,
      type: identity.type,
      pluginName: identity.pluginName,
      key: identity.key,
    })
    return
  }

  const url = getHotkeyOpenUrl(hotkey)
  if (url) {
    await shell.openExternal(url)
    return
  }

  logger.warn('Plugin hotkey has no supported action.', {
    name,
    type: identity.type,
    pluginName: identity.pluginName,
    key: identity.key,
  })
}

function getShortcutHandler(name: string): (() => void | Promise<void>) | null {
  const defaultShortcut = defaultShortcuts[name]
  if (defaultShortcut) {
    return defaultShortcut.handler
  }

  if (parsePluginHotkeyName(name)) {
    return () => handlePluginHotkey(name)
  }

  return null
}

export function registerGlobalShortcuts(scope: 'all' | string = 'all'): void {
  const entries =
    scope === 'all'
      ? Object.entries(defaultShortcuts)
      : Object.entries(defaultShortcuts).filter(([name]) => name === scope)

  for (const [name, shortcut] of entries) {
    const accelerator = getShortcutAccelerator(name)
    if (!accelerator) {
      continue
    }

    const registered = globalShortcut.register(accelerator, () => {
      logger.debug('Global shortcut triggered.', {
        name,
        shortcut: accelerator,
      })
      void Promise.resolve(shortcut.handler()).catch((error) => {
        logger.error('Global shortcut handler failed.', error, {
          name,
          shortcut: accelerator,
        })
      })
    })

    if (!registered) {
      logger.warn('Global shortcut registration failed.', {
        name,
        shortcut: accelerator,
      })
    }
  }

  if (scope === 'all') {
    void registerInstalledPluginShortcuts()
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}

export function getShortcutAccelerator(name: string): string {
  if (!(name in defaultShortcuts) && !parsePluginHotkeyName(name)) {
    return ''
  }

  const value = getConfig(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function registerGlobalShortcutByName(
  name: string,
  accelerator: string,
): Promise<boolean> {
  const handler = getShortcutHandler(name)
  const normalizedAccelerator = accelerator.trim()

  if (!handler || !normalizedAccelerator) {
    return false
  }

  const pluginHotkey = parsePluginHotkeyName(name)
  if (
    pluginHotkey &&
    !(await getInstalledPluginHotkey(pluginHotkey.type, pluginHotkey.pluginName, pluginHotkey.key))
  ) {
    return false
  }

  const previousAccelerator = getShortcutAccelerator(name)
  if (previousAccelerator) {
    globalShortcut.unregister(previousAccelerator)
  }

  const registered = globalShortcut.register(normalizedAccelerator, () => {
    logger.debug('Global shortcut triggered.', {
      name,
      shortcut: normalizedAccelerator,
    })
    void Promise.resolve(handler()).catch((error) => {
      logger.error('Global shortcut handler failed.', error, {
        name,
        shortcut: normalizedAccelerator,
      })
    })
  })

  if (registered) {
    await setConfig(name, normalizedAccelerator)
  } else {
    logger.warn('Global shortcut registration failed.', {
      name,
      shortcut: normalizedAccelerator,
    })
  }

  return registered
}

async function registerInstalledPluginShortcuts(): Promise<void> {
  const plugins = await listInstalledPlugins()
  for (const plugin of plugins) {
    for (const hotkey of plugin.hotkeys) {
      if (typeof hotkey !== 'object' || hotkey === null) {
        continue
      }

      const key = (hotkey as { key?: unknown }).key
      if (typeof key !== 'string' || !key) {
        continue
      }

      const name = `${PLUGIN_HOTKEY_PREFIX}${plugin.type}:${plugin.name}:${key}`
      const accelerator = getShortcutAccelerator(name)
      if (accelerator) {
        await registerGlobalShortcutByName(name, accelerator)
      }
    }
  }
}

export function unregisterGlobalShortcut(accelerator: string): void {
  if (accelerator.trim()) {
    globalShortcut.unregister(accelerator.trim())
  }
}

export function isGlobalShortcutRegistered(accelerator: string): boolean {
  return accelerator.trim() ? globalShortcut.isRegistered(accelerator.trim()) : false
}
