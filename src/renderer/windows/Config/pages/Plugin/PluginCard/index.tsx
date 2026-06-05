import { Button, Switch, Tooltip } from '@heroui/react'
import { MdDeleteOutline, MdHome, MdKeyboardAlt, MdSettings } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import React from 'react'

import { getCardActions } from '../logic'
import { openUrl } from '@/renderer/lib/electron/compat/opener'
import type { InstalledPlugin } from '../installedPlugins'

interface PluginCardProps {
  plugin: InstalledPlugin
  onOpenHotkeys: (plugin: InstalledPlugin) => void
  onToggleEnabled: (plugin: InstalledPlugin, enabled: boolean) => void
  onDelete: (plugin: InstalledPlugin) => void
  onOpenSettings: (plugin: InstalledPlugin) => void
}

export default function PluginCard(props: PluginCardProps) {
  const { plugin, onOpenHotkeys, onToggleEnabled, onDelete, onOpenSettings } = props
  const { t } = useTranslation()
  const actions = getCardActions(plugin)

  return (
    <div className="bg-content2 rounded-md px-3 py-4 flex justify-between gap-4">
      <img
        src={plugin.icon || 'logo/plugin.svg'}
        className="h-10 w-10 shrink-0 rounded-md object-contain bg-content3"
        draggable={false}
      />
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
        {actions.homepage && (
          <Tooltip content={t('config.plugin.homepage')}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t('config.plugin.homepage')}
              onPress={() => {
                void openUrl(plugin.homepage)
              }}
            >
              <MdHome className="text-xl" />
            </Button>
          </Tooltip>
        )}
        {actions.settings && (
          <Tooltip content={t('config.plugin.settings')}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t('config.plugin.settings')}
              onPress={() => onOpenSettings(plugin)}
            >
              <MdSettings className="text-xl" />
            </Button>
          </Tooltip>
        )}
        {actions.hotkey && (
          <Tooltip content={t('config.plugin.hotkeys')}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t('config.plugin.hotkeys')}
              onPress={() => onOpenHotkeys(plugin)}
            >
              <MdKeyboardAlt className="text-xl" />
            </Button>
          </Tooltip>
        )}
        {actions.delete && (
          <Tooltip content={t('config.plugin.delete')}>
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
          </Tooltip>
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
