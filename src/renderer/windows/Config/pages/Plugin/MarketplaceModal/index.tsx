import {
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdClose, MdFolderOpen, MdInsertDriveFile, MdRefresh } from 'react-icons/md'

import {
  DEFAULT_MARKETPLACE_SOURCE,
  installMarketplacePluginSource,
  loadCustomMarketplaceSources,
  loadMarketplacePlugins,
  MarketplacePlugin,
  MarketplaceSourceStatus,
  saveCustomMarketplaceSources,
} from '../marketplace'
import { emit } from '@/renderer/lib/electron/compat/event'
import { open } from '@/renderer/lib/electron/compat/dialog'
import { logger } from '@/renderer/lib/logger'

interface MarketplaceModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onInstalled?: () => unknown | Promise<unknown>
}

export default function MarketplaceModal(props: MarketplaceModalProps) {
  const { isOpen, onOpenChange, onInstalled } = props
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([])
  const [sourceStatuses, setSourceStatuses] = useState<MarketplaceSourceStatus[]>([])
  const [customSources, setCustomSources] = useState<string[]>([])
  const [sourceDraft, setSourceDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)

  const refreshMarketplace = useCallback(
    async (sources: string[]) => {
      setLoading(true)
      try {
        const result = await loadMarketplacePlugins(sources)
        setPlugins(result.plugins)
        setSourceStatuses(result.sources)
        logger.info('Plugin marketplace refreshed.', {
          pluginCount: result.plugins.length,
          sourceCount: result.sources.length,
        })
      } catch (error) {
        logger.error('Plugin marketplace refresh failed.', error)
        toast.error(t('config.plugin.market.refresh_failed'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadCustomMarketplaceSources().then(async (sources) => {
      setCustomSources(sources)
      await refreshMarketplace(sources)
    })
  }, [isOpen, refreshMarketplace])

  async function persistSources(nextSources: string[]) {
    const saved = await saveCustomMarketplaceSources(nextSources)
    setCustomSources(saved)
    await refreshMarketplace(saved)
  }

  async function addSource(source: string) {
    const nextSource = source.trim()
    if (!nextSource || nextSource === DEFAULT_MARKETPLACE_SOURCE) {
      setSourceDraft('')
      return
    }

    await persistSources([...customSources, nextSource])
    setSourceDraft('')
  }

  async function addSourceFromFile() {
    const selected = await open({
      multiple: false,
      properties: ['openFile'],
      filters: [
        { name: t('config.plugin.market.marketplace_files'), extensions: ['json'] },
        { name: t('config.plugin.file_filter.all_files'), extensions: ['*'] },
      ],
    })
    if (!selected) {
      return
    }
    const source = typeof selected === 'string' ? selected : selected[0]
    if (source) {
      await addSource(source)
    }
  }

  async function addSourceFromFolder() {
    const selected = await open({
      multiple: false,
      properties: ['openDirectory'],
    })
    if (!selected) {
      return
    }
    const source = typeof selected === 'string' ? selected : selected[0]
    if (source) {
      await addSource(source)
    }
  }

  async function removeSource(source: string) {
    await persistSources(customSources.filter((item) => item !== source))
  }

  async function installPlugin(plugin: MarketplacePlugin) {
    setInstallingId(plugin.id)
    try {
      const source = await installMarketplacePluginSource(plugin)
      await emit('reload_plugin_list')
      await onInstalled?.()
      toast.success(t('config.plugin.market.install_success'))
      logger.info('Marketplace plugin installed.', {
        id: plugin.id,
        source,
      })
    } catch (error) {
      logger.error('Marketplace plugin install failed.', error, {
        id: plugin.id,
        download: plugin.download,
      })
      toast.error(t('config.plugin.market.install_failed'))
    } finally {
      setInstallingId(null)
    }
  }

  function sourceErrorText(source: MarketplaceSourceStatus) {
    if (!source.error) {
      return ''
    }

    switch (source.errorKind) {
      case 'http':
        return t('config.plugin.market.source_error_http', { status: source.errorStatus })
      case 'invalid-index':
        return t('config.plugin.market.source_error_invalid')
      case 'local-json':
        return t('config.plugin.market.source_error_local_json')
      case 'missing':
        return t('config.plugin.market.source_error_missing')
      case 'unavailable':
        return t('config.plugin.market.source_error_unavailable')
      default:
        return t('config.plugin.market.source_error_generic', { message: source.error })
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside" size="5xl">
      <ModalContent className="max-h-[86vh]">
        {(onClose) => (
          <>
            <ModalHeader className="pr-10">{t('config.plugin.market.title')}</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('config.plugin.market.sources')}</h3>
                    <p className="text-xs text-default-500">
                      {t('config.plugin.market.sources_description')}
                    </p>
                  </div>
                  <Divider />
                  <div className="flex flex-col gap-2">
                    {sourceStatuses.map((source) => (
                      <div key={source.source} className="rounded-md bg-content2 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">
                              {source.isDefault
                                ? t('config.plugin.market.default_source')
                                : source.source}
                            </div>
                            {source.isDefault && (
                              <div className="truncate text-xs text-default-400">
                                {source.source}
                              </div>
                            )}
                          </div>
                          <Chip size="sm" color={source.ok ? 'success' : 'danger'} variant="flat">
                            {source.ok
                              ? t('config.plugin.market.source_ok', { count: source.count })
                              : t('config.plugin.market.source_failed')}
                          </Chip>
                        </div>
                        {source.error && (
                          <p className="mt-1 line-clamp-2 text-xs text-danger">
                            {sourceErrorText(source)}
                          </p>
                        )}
                        {!source.isDefault && (
                          <Button
                            size="sm"
                            variant="light"
                            className="mt-1 px-0"
                            startContent={<MdClose className="text-lg" />}
                            onPress={() => {
                              void removeSource(source.source)
                            }}
                          >
                            {t('config.plugin.market.remove_source')}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Divider />
                  <Input
                    size="sm"
                    variant="bordered"
                    label={t('config.plugin.market.add_source')}
                    placeholder={t('config.plugin.market.source_placeholder')}
                    value={sourceDraft}
                    onValueChange={setSourceDraft}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void addSource(sourceDraft)
                      }
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<MdAdd className="text-lg" />}
                      onPress={() => {
                        void addSource(sourceDraft)
                      }}
                    >
                      {t('config.plugin.market.add')}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<MdInsertDriveFile className="text-lg" />}
                      onPress={() => {
                        void addSourceFromFile()
                      }}
                    >
                      {t('config.plugin.market.add_file')}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<MdFolderOpen className="text-lg" />}
                      onPress={() => {
                        void addSourceFromFolder()
                      }}
                    >
                      {t('config.plugin.market.add_folder')}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<MdRefresh className="text-lg" />}
                      isLoading={loading}
                      onPress={() => {
                        void refreshMarketplace(customSources)
                      }}
                    >
                      {t('config.plugin.market.refresh_list')}
                    </Button>
                  </div>
                </div>
                <Divider />
                <div className="flex flex-col gap-2.5">
                  {plugins.map((plugin) => (
                    <div key={plugin.id} className="bg-content2 rounded-md px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{plugin.display}</h3>
                          <p className="text-xs text-default-500">
                            {plugin.version} · {plugin.author}
                          </p>
                          <p className="text-sm text-default-500 mt-1">{plugin.description}</p>
                          <p className="mt-2 truncate text-xs text-default-400">{plugin.source}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          isLoading={installingId === plugin.id}
                          onPress={() => {
                            void installPlugin(plugin)
                          }}
                        >
                          {t('config.plugin.market.install')}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {plugins.length === 0 && !loading && (
                    <div className="rounded-md bg-content2 px-3 py-8 text-center text-sm text-default-500">
                      {t('config.plugin.market.empty')}
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                {t('common.cancel')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
