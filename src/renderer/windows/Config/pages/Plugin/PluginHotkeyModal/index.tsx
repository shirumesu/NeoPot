import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import React from 'react'

import PluginHotkeyEditor from '../../../components/PluginHotkeyEditor'
import { hotkeysForPlugin } from '../logic'

function isPluginManifestHotkey(value: unknown): value is {
  key: string
  display: string
  default: string
  handler: string
} {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.display === 'string' &&
    typeof candidate.default === 'string' &&
    typeof candidate.handler === 'string' &&
    candidate.handler.trim().length > 0
  )
}

export default function PluginHotkeyModal(props: any) {
  const { isOpen, onOpenChange, plugin } = props
  const { t } = useTranslation()
  const rows = hotkeysForPlugin(
    (plugin?.hotkeys ?? []).filter(isPluginManifestHotkey).map((hotkey: any) => ({
      pluginId: plugin.id,
      pluginType: plugin.type,
      pluginName: plugin.name,
      pluginDisplay: plugin.display,
      key: hotkey.key,
      display: hotkey.display,
      hotkey: hotkey.default,
    })),
    plugin?.id,
  )

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
