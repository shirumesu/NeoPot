import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { InstalledPlugin } from '../installedPlugins'
import { useConfig } from '../../../../../hooks'
import { useConfigSave } from '../../../hooks/useConfigSave'
import SafeDropdownMenu from '@/renderer/components/SafeDropdownMenu'
import ConfigItem from '../../../components/ConfigItem'

function pluginOptionsConfigKey(plugin: InstalledPlugin): string {
  return `plugin_options:${plugin.type}:${plugin.name}`
}

interface PluginOption {
  key: string
  display: string
  type?: string
  default?: string
  options?: Record<string, string>
}

function isPluginOption(value: unknown): value is PluginOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const option = value as Record<string, unknown>
  const options = option.options
  return (
    typeof option.key === 'string' &&
    typeof option.display === 'string' &&
    (option.type === undefined || typeof option.type === 'string') &&
    (option.default === undefined || typeof option.default === 'string') &&
    (options === undefined ||
      (typeof options === 'object' &&
        options !== null &&
        Object.values(options).every((label) => typeof label === 'string')))
  )
}

export default function PluginSettingsModal(props: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  plugin: InstalledPlugin | null
}) {
  const { isOpen, onOpenChange, plugin } = props
  const [pluginOptions, setPluginOptions] = useConfig<Record<string, unknown>>(
    plugin ? pluginOptionsConfigKey(plugin) : 'plugin_options:none',
    {},
    { sync: false },
  )
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-h-[80vh]">
        {(onClose) => (
          <>
            <ModalHeader>{plugin?.display ?? t('config.plugin.settings')}</ModalHeader>
            <ModalBody>
              {plugin &&
                pluginOptions &&
                plugin.options.filter(isPluginOption).map((option) => {
                  const value = pluginOptions[option.key]
                  const optionChoices = option.options ?? {}
                  const currentValue =
                    typeof value === 'string'
                      ? value
                      : typeof option.default === 'string'
                        ? option.default
                        : ''

                  return (
                    <ConfigItem
                      key={option.key}
                      title={
                        <span className="my-auto select-none cursor-default">{option.display}</span>
                      }
                    >
                      {option.type === 'select' && option.options ? (
                        <Dropdown>
                          <DropdownTrigger>
                            <Button variant="bordered" className="max-w-[60%]">
                              {optionChoices[currentValue] ?? currentValue}
                            </Button>
                          </DropdownTrigger>
                          <SafeDropdownMenu
                            aria-label={option.key}
                            className="max-h-[40vh] overflow-y-auto"
                            onAction={(key: React.Key) => {
                              setPluginOptions({
                                ...pluginOptions,
                                [option.key]: String(key),
                              })
                            }}
                          >
                            {Object.keys(optionChoices).map((key) => (
                              <DropdownItem key={key}>{optionChoices[key]}</DropdownItem>
                            ))}
                          </SafeDropdownMenu>
                        </Dropdown>
                      ) : (
                        <Input
                          value={currentValue}
                          variant="bordered"
                          className="max-w-[60%]"
                          onValueChange={(nextValue) => {
                            setPluginOptions({
                              ...pluginOptions,
                              [option.key]: nextValue,
                            })
                          }}
                        />
                      )}
                    </ConfigItem>
                  )
                })}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                color="primary"
                onPress={async () => {
                  if (!plugin || !pluginOptions) {
                    return
                  }

                  const saved = await saveConfig(
                    pluginOptionsConfigKey(plugin),
                    null,
                    setPluginOptions,
                    pluginOptions,
                    { compareCurrent: false },
                  )
                  if (saved) {
                    onClose()
                  }
                }}
              >
                {t('common.save')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
