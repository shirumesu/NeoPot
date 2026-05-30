// @ts-nocheck
import { Button, Switch } from '@heroui/react'
import { MdDeleteOutline, MdKeyboardAlt, MdSettings } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import React from 'react'

import { getCardActions } from '../logic'

export default function PluginCard(props) {
  const { plugin, onOpenHotkeys, onToggleEnabled, onDelete, onOpenSettings } = props
  const { t } = useTranslation()
  const actions = getCardActions(plugin)

  return (
    <div className="bg-content2 rounded-md px-3 py-4 flex justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="font-semibold text-base truncate">{plugin.display}</h2>
          <span className="text-xs rounded bg-content3 px-2 py-0.5">{plugin.type}</span>
          <span className="text-xs text-default-500">
            {t('config.plugin.version')}: {plugin.version}
          </span>
          <span className="text-xs text-default-500">
            {t('config.plugin.author')}: {plugin.author}
          </span>
        </div>
        <p className="text-sm text-default-500 mt-1 break-words">{plugin.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions.settings && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.settings')}
            onPress={() => onOpenSettings(plugin)}
          >
            <MdSettings className="text-xl" />
          </Button>
        )}
        {actions.hotkey && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.hotkeys')}
            onPress={() => onOpenHotkeys(plugin)}
          >
            <MdKeyboardAlt className="text-xl" />
          </Button>
        )}
        {actions.delete && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            aria-label={t('config.plugin.delete')}
            onPress={() => onDelete(plugin)}
          >
            <MdDeleteOutline className="text-xl" />
          </Button>
        )}
        {actions.enable && (
          <Switch
            size="sm"
            aria-label={t('config.plugin.enabled')}
            isSelected={plugin.enabled}
            onValueChange={(next) => onToggleEnabled(plugin, next)}
          />
        )}
      </div>
    </div>
  )
}
