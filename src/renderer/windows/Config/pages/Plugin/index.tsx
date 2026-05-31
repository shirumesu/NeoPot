import { Button, Card, CardBody, Divider, Switch } from '@heroui/react'
import { open } from '@/renderer/lib/electron/compat/dialog'
import { emit } from '@/renderer/lib/electron/compat/event'
import React, { useEffect, useState } from 'react'
import { MdDownload, MdFolderOpen, MdRefresh } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

import PluginCard from './PluginCard'
import PluginHotkeyModal from './PluginHotkeyModal'
import MarketplaceModal from './MarketplaceModal'
import { pluginApi } from '@/renderer/lib/electron/adapter'
import { useConfig } from '../../../../hooks'
import { checkPluginUpdates } from './marketplace'
import { loadInstalledPlugins } from './installedPlugins'

export default function Plugin() {
  const [plugins, setPlugins] = useState([])
  const [autoUpdate, setAutoUpdate] = useConfig('plugin_auto_check_update', false)
  const [hotkeyPlugin, setHotkeyPlugin] = useState(null)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [updates, setUpdates] = useState(null)
  const [installing, setInstalling] = useState(false)
  const { t } = useTranslation()

  const refreshPlugins = () => {
    loadInstalledPlugins().then((installed) => {
      setPlugins(installed)
    })
  }

  useEffect(refreshPlugins, [])

  async function installFromFile() {
    setInstalling(true)
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: '*.npot',
            extensions: ['npot'],
          },
        ],
      })
      const files = Array.isArray(selected) ? selected : selected ? [selected] : []
      for (const file of files) {
        await pluginApi.install(file)
      }
      if (files.length > 0) {
        await emit('reload_plugin_list')
        refreshPlugins()
      }
    } finally {
      setInstalling(false)
    }
  }

  async function togglePlugin(plugin, enabled) {
    await pluginApi.setEnabled(plugin.type, plugin.name, enabled)
    setPlugins((current) =>
      current.map((item) => (item.id === plugin.id ? { ...item, enabled } : item)),
    )
    await emit('reload_plugin_list')
  }

  async function deletePlugin(plugin) {
    await pluginApi.uninstall(plugin.type, plugin.name)
    setPlugins((current) => current.filter((item) => item.id !== plugin.id))
    await emit('reload_plugin_list')
  }

  async function checkUpdates() {
    setUpdates(await checkPluginUpdates(plugins))
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">{t('config.plugin.market.title')}</h2>
              <p className="text-sm text-default-500">{t('config.plugin.market.description')}</p>
            </div>
            <Button size="sm" variant="flat" onPress={() => setMarketplaceOpen(true)}>
              {t('config.plugin.market.browse')}
            </Button>
          </div>
          <Divider />
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">{t('config.plugin.update.title')}</h2>
              <p className="text-sm text-default-500">
                {updates === null
                  ? t('config.plugin.update.installed_count', { count: plugins.length })
                  : updates.length > 0
                    ? t('config.plugin.update.available_count', { count: updates.length })
                    : t('config.plugin.update.none')}
              </p>
            </div>
            <Button size="sm" variant="flat" onPress={checkUpdates}>
              {t('config.plugin.update.check')}
            </Button>
          </div>
          <Divider />
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">{t('config.plugin.auto_update.title')}</h2>
              <p className="text-sm text-default-500">
                {t('config.plugin.auto_update.description')}
              </p>
            </div>
            {autoUpdate !== null && (
              <Switch
                size="sm"
                isSelected={autoUpdate}
                onValueChange={(value) => setAutoUpdate(value, true)}
              />
            )}
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">{t('config.plugin.installed')}</h2>
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.refresh')}
            onPress={refreshPlugins}
          >
            <MdRefresh className="text-xl" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.open_folder')}
            onPress={() => {}}
          >
            <MdFolderOpen className="text-xl" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.install_from_file')}
            isLoading={installing}
            onPress={installFromFile}
          >
            <MdDownload className="text-xl" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onOpenHotkeys={setHotkeyPlugin}
            onToggleEnabled={togglePlugin}
            onDelete={deletePlugin}
            onOpenSettings={() => {}}
          />
        ))}
      </div>
      <PluginHotkeyModal
        isOpen={hotkeyPlugin !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHotkeyPlugin(null)
          }
        }}
        plugin={hotkeyPlugin}
      />
      <MarketplaceModal isOpen={marketplaceOpen} onOpenChange={setMarketplaceOpen} />
    </div>
  )
}
