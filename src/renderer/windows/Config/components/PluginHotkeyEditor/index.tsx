import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'

import { isHotkeyRegistered, unregisterHotkey } from '@/renderer/lib/electron/hotkey'
import { invokeCommand } from '@/renderer/lib/electron/command'
import { osType } from '@/renderer/lib/config/env'
import { shortcutFromKeyboardEvent } from '@/shared/hotkeyAccelerator'
import ConfigItem from '../ConfigItem'
import type { PluginHotkeyRow } from '@/renderer/lib/plugin/pluginHotkeyManifest'

function pluginHotkeyConfigKey(row: PluginHotkeyRow): string {
  return `plugin_hotkey:${row.pluginType}:${row.pluginName}:${row.key}`
}

export default function PluginHotkeyEditor(props: { rows: PluginHotkeyRow[] }) {
  const { rows } = props
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  const configKeys = useMemo(() => rows.map(pluginHotkeyConfigKey), [rows])

  useEffect(() => {
    let disposed = false
    Promise.all(
      rows.map(async (row) => {
        const configKey = pluginHotkeyConfigKey(row)
        const stored = await window.neoPot.config.get(configKey)
        return [configKey, typeof stored === 'string' ? stored : row.hotkey || ''] as const
      }),
    ).then((entries) => {
      if (!disposed) {
        setValues(Object.fromEntries(entries))
      }
    })

    return () => {
      disposed = true
    }
  }, [rows, configKeys])

  async function saveHotkey(row: PluginHotkeyRow) {
    const configKey = pluginHotkeyConfigKey(row)
    const nextValue = values[configKey] ?? ''
    const previousValue = await window.neoPot.config.get(configKey)
    const previousShortcut = typeof previousValue === 'string' ? previousValue : ''

    try {
      if (nextValue && nextValue !== previousShortcut && (await isHotkeyRegistered(nextValue))) {
        toast.error(t('config.hotkey.is_register'))
        return
      }

      if (previousShortcut && previousShortcut !== nextValue) {
        await unregisterHotkey(previousShortcut)
      }

      if (!nextValue) {
        await window.neoPot.config.set(configKey, '')
        toast.success(t('config.hotkey.success'))
        return
      }

      const registered = await invokeCommand('register_shortcut_by_frontend', {
        name: configKey,
        shortcut: nextValue,
      })

      if (!registered) {
        toast.error(t('config.common.save_failed'))
        return
      }

      toast.success(t('config.hotkey.success'))
    } catch {
      toast.error(t('config.common.save_failed'))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const configKey = pluginHotkeyConfigKey(row)

        return (
          <ConfigItem
            key={configKey}
            title={
              <span className="min-w-0">
                <span className="my-auto block truncate">{row.display}</span>
                <span className="block text-xs text-default-500 truncate">{row.pluginDisplay}</span>
              </span>
            }
          >
            <Input
              type="hotkey"
              variant="bordered"
              value={values[configKey] ?? row.hotkey ?? ''}
              label={t('config.hotkey.set_hotkey')}
              className="max-w-[60%]"
              onKeyDown={(event) => {
                event.preventDefault()
                setValues((current) => ({
                  ...current,
                  [configKey]: event.keyCode === 8 ? '' : shortcutFromKeyboardEvent(event, osType),
                }))
              }}
              endContent={
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    void saveHotkey(row)
                  }}
                >
                  {t('common.ok')}
                </Button>
              }
            />
          </ConfigItem>
        )
      })}
    </div>
  )
}
