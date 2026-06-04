import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import React, { useEffect, useState } from 'react'

import {
  installMarketplacePluginSource,
  loadMarketplacePlugins,
  MarketplacePlugin,
} from '../marketplace'
import { emit } from '@/renderer/lib/electron/compat/event'
import { logger } from '@/renderer/lib/logger'

export default function MarketplaceModal(props: any) {
  const { isOpen, onOpenChange, onInstalled } = props
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([])
  const [installingId, setInstallingId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadMarketplacePlugins().then(setPlugins)
    }
  }, [isOpen])

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

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{t('config.plugin.market.title')}</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-2">
                {plugins.map((plugin) => (
                  <div key={plugin.id} className="bg-content2 rounded-md px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{plugin.display}</h3>
                        <p className="text-xs text-default-500">
                          {plugin.version} · {plugin.author}
                        </p>
                        <p className="text-sm text-default-500 mt-1">{plugin.description}</p>
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
