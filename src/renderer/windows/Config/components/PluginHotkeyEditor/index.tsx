import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'

import { configApi } from '@/renderer/lib/electron/adapter'
import { isRegistered, unregister } from '@/renderer/lib/electron/compat/globalShortcut'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { osType } from '@/renderer/lib/config/env'
import { shortcutFromKeyboardEvent } from '@/shared/hotkeyAccelerator'

type PluginHotkeyRow = {
  pluginId: string
  pluginType: string
  pluginName: string
  pluginDisplay: string
  key: string
  display: string
  hotkey: string
}

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
        const stored = await configApi.get(configKey)
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
    const previousValue = await configApi.get(configKey)
    const previousShortcut = typeof previousValue === 'string' ? previousValue : ''

    try {
      if (nextValue && nextValue !== previousShortcut && (await isRegistered(nextValue))) {
        toast.error(t('config.hotkey.is_register'))
        return
      }

      if (previousShortcut && previousShortcut !== nextValue) {
        await unregister(previousShortcut)
      }

      if (!nextValue) {
        await configApi.set(configKey, '')
        toast.success(t('config.hotkey.success'))
        return
      }

      const registered = await invoke<boolean>('register_shortcut_by_frontend', {
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
          <div key={configKey} className="config-item">
            <div className="min-w-0">
              <h3 className="my-auto truncate">{row.display}</h3>
              <p className="text-xs text-default-500 truncate">{row.pluginDisplay}</p>
            </div>
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
          </div>
        )
      })}
    </div>
  )
}
