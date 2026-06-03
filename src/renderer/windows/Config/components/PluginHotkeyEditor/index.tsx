import { Button, Input } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React from 'react'

export default function PluginHotkeyEditor(props: any) {
  const { rows } = props
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row: any) => (
        <div key={`${row.pluginId}:${row.key}`} className="config-item">
          <div className="min-w-0">
            <h3 className="my-auto truncate">{row.display}</h3>
            <p className="text-xs text-default-500 truncate">{row.pluginDisplay}</p>
          </div>
          <Input
            // Capture, conflict detection, persistence, and real triggering are deferred to the runtime block.
            type="hotkey"
            variant="bordered"
            value={row.hotkey}
            label={t('config.hotkey.set_hotkey')}
            className="max-w-[60%]"
            readOnly
            endContent={
              <Button size="sm" variant="flat" isDisabled>
                {t('common.ok')}
              </Button>
            }
          />
        </div>
      ))}
    </div>
  )
}
