import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import PluginHotkeyEditor from '../../../components/PluginHotkeyEditor'
import type { InstalledPlugin } from '../installedPlugins'
import { createPluginHotkeyRows } from '@/renderer/lib/plugin/pluginHotkeyManifest'

interface PluginHotkeyModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  plugin: InstalledPlugin | null
}

export default function PluginHotkeyModal(props: PluginHotkeyModalProps) {
  const { isOpen, onOpenChange, plugin } = props
  const { t } = useTranslation()
  const rows = plugin ? createPluginHotkeyRows(plugin) : []

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{plugin?.display ?? t('config.plugin.hotkeys')}</ModalHeader>
            <ModalBody>
              <PluginHotkeyEditor rows={rows} />
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
