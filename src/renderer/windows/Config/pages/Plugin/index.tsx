import { Button, Card, CardBody, Divider, Switch } from '@heroui/react'
import { open } from '@/renderer/lib/electron/compat/dialog'
import { emit } from '@/renderer/lib/electron/compat/event'
import React, { useEffect, useState } from 'react'
import { MdDownload, MdFolderOpen, MdRefresh } from 'react-icons/md'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import PluginCard from './PluginCard'
import PluginHotkeyModal from './PluginHotkeyModal'
import PluginSettingsModal from './PluginSettingsModal'
import MarketplaceModal from './MarketplaceModal'
import { configApi, pluginApi } from '@/renderer/lib/electron/adapter'
import { useConfig } from '../../../../hooks'
import { checkPluginUpdates, MarketplacePlugin } from './marketplace'
import { InstalledPlugin, loadInstalledPlugins } from './installedPlugins'
import { logger } from '@/renderer/lib/logger'
import { useConfigSave } from '../../hooks/useConfigSave'

const AUTO_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

export default function Plugin() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([])
  const [autoUpdate, setAutoUpdate] = useConfig('plugin_auto_check_update', true)
  const [hotkeyPlugin, setHotkeyPlugin] = useState<InstalledPlugin | null>(null)
  const [settingsPlugin, setSettingsPlugin] = useState<InstalledPlugin | null>(null)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [updates, setUpdates] = useState<
    (MarketplacePlugin & { installedVersion: string })[] | null
  >(null)
  const [installing, setInstalling] = useState(false)
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  const refreshPlugins = async () => {
    const installed = await loadInstalledPlugins()
    setPlugins(installed)
    logger.debug('Plugin list refreshed.', {
      count: installed.length,
    })
    return installed
  }

  useEffect(() => {
    void refreshPlugins()
  }, [])

  useEffect(() => {
    if (autoUpdate !== true || plugins.length === 0) {
      return
    }

    configApi.get('plugin_last_check_update_at').then((value) => {
      const lastCheckedAt = typeof value === 'number' ? value : 0
      if (Date.now() - lastCheckedAt < AUTO_UPDATE_INTERVAL_MS) {
        return
      }

      void checkUpdates({ silent: true })
    })
  }, [autoUpdate, plugins])

  async function installSources(sources: string[]) {
    if (sources.length === 0) {
      return
    }

    setInstalling(true)
    try {
      logger.info('Plugin install requested.', {
        count: sources.length,
      })
      for (const source of sources) {
        await pluginApi.install(source)
      }
      await emit('reload_plugin_list')
      await refreshPlugins()
      toast.success(t('config.plugin.install_success'))
    } catch (error) {
      logger.error('Plugin install failed.', error)
      toast.error(t('config.plugin.install_failed'))
    } finally {
      setInstalling(false)
    }
  }

  async function installFromFile() {
    const selected = await open({
      multiple: true,
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      filters: [
        {
          name: 'Plugin Package',
          extensions: ['zip', 'npot'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    })
    const files = Array.isArray(selected) ? selected : selected ? [selected] : []
    await installSources(files)
  }

  async function togglePlugin(plugin: InstalledPlugin, enabled: boolean) {
    await pluginApi.setEnabled(plugin.type, plugin.name, enabled)
    logger.info('Plugin enabled state changed from settings page.', {
      type: plugin.type,
      name: plugin.name,
      enabled,
    })
    setPlugins((current) =>
      current.map((item) => (item.id === plugin.id ? { ...item, enabled } : item)),
    )
    await emit('reload_plugin_list')
  }

  async function deletePlugin(plugin: InstalledPlugin) {
    await pluginApi.uninstall(plugin.type, plugin.name)
    logger.info('Plugin deleted from settings page.', {
      type: plugin.type,
      name: plugin.name,
    })
    setPlugins((current) => current.filter((item) => item.id !== plugin.id))
    await emit('reload_plugin_list')
  }

  async function checkUpdates(
    options: { silent?: boolean } = {},
    installedPlugins: InstalledPlugin[] = plugins,
  ) {
    logger.debug('Plugin update check requested.', {
      count: installedPlugins.length,
    })
    const nextUpdates = await checkPluginUpdates(installedPlugins)
    setUpdates(nextUpdates)
    await configApi.set('plugin_last_check_update_at', Date.now())
    if (!options.silent) {
      toast.success(t('config.plugin.update.checked'))
    }
  }

  async function installMarketplacePlugin(plugin: MarketplacePlugin) {
    setInstalling(true)
    try {
      await pluginApi.installFromUrl(plugin.download)
      await emit('reload_plugin_list')
      const installed = await refreshPlugins()
      await checkUpdates({ silent: true }, installed)
      toast.success(t('config.plugin.update.install_success'))
    } catch (error) {
      logger.error('Plugin update install failed.', error, {
        id: plugin.id,
      })
      toast.error(t('config.plugin.update.install_failed'))
    } finally {
      setInstalling(false)
    }
  }

  async function openPluginFolder() {
    const errorMessage = await pluginApi.openFolder()
    if (errorMessage) {
      toast.error(errorMessage)
    }
  }

  return (
    <div
      className="w-full flex flex-col gap-4"
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const droppedFiles = [...event.dataTransfer.files]
          .map((file) => (file as File & { path?: string }).path)
          .filter((filePath): filePath is string => typeof filePath === 'string')
        void installSources(droppedFiles)
      }}
    >
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
            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                void checkUpdates()
              }}
            >
              {t('config.plugin.update.check')}
            </Button>
          </div>
          {updates && updates.length > 0 && (
            <div className="flex flex-col gap-2">
              {updates.map((plugin) => (
                <div
                  key={plugin.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-content2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{plugin.display}</div>
                    <div className="text-xs text-default-500">
                      {plugin.installedVersion} -&gt; {plugin.version}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    isLoading={installing}
                    onPress={() => {
                      void installMarketplacePlugin(plugin)
                    }}
                  >
                    {t('config.plugin.update.install')}
                  </Button>
                </div>
              ))}
            </div>
          )}
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
                onValueChange={(value) => {
                  saveConfig('plugin_auto_check_update', autoUpdate, setAutoUpdate, value)
                }}
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
            onPress={() => {
              void refreshPlugins()
            }}
          >
            <MdRefresh className="text-xl" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.open_folder')}
            onPress={() => {
              void openPluginFolder()
            }}
          >
            <MdFolderOpen className="text-xl" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={t('config.plugin.install_from_file')}
            isLoading={installing}
            onPress={() => {
              void installFromFile()
            }}
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
            onOpenSettings={setSettingsPlugin}
          />
        ))}
      </div>
      <PluginSettingsModal
        isOpen={settingsPlugin !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSettingsPlugin(null)
          }
        }}
        plugin={settingsPlugin}
      />
      <PluginHotkeyModal
        isOpen={hotkeyPlugin !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setHotkeyPlugin(null)
          }
        }}
        plugin={hotkeyPlugin}
      />
      <MarketplaceModal
        isOpen={marketplaceOpen}
        onOpenChange={setMarketplaceOpen}
        onInstalled={refreshPlugins}
      />
    </div>
  )
}
