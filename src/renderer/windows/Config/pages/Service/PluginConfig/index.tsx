import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { Button, Input } from '@heroui/react'
import { DropdownTrigger } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { Dropdown } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { openUrl } from '@/renderer/lib/electron/opener'

import { useConfig } from '../../../../../hooks'
import type { ServiceConfigComponentProps } from '../types'
import ConfigItem from '../../../components/ConfigItem'
import ProviderConfigForm from '../ProviderConfigForm'
import InstanceNameInput from '../InstanceNameInput'

interface PluginNeed {
  key: string
  display: string
  type?: string
  options?: Record<string, string>
}

function isPluginNeed(value: unknown): value is PluginNeed {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const options = candidate.options
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.display === 'string' &&
    (candidate.type === undefined || typeof candidate.type === 'string') &&
    (options === undefined ||
      (typeof options === 'object' &&
        options !== null &&
        Object.values(options).every((option) => typeof option === 'string')))
  )
}

export function PluginConfig(props: ServiceConfigComponentProps) {
  const { instanceKey, updateServiceList, onClose, name, pluginList } = props
  const [pluginConfig, setPluginConfig] = useConfig<Record<string, unknown>>(
    instanceKey,
    {},
    { sync: false },
  )
  const { t } = useTranslation()
  const pluginNeeds = (pluginList[name].needs as unknown[]).filter(isPluginNeed)
  const configuredInstanceName = pluginConfig?.[INSTANCE_NAME_CONFIG_KEY]

  return (
    <>
      <ConfigItem
        title={
          <span className="my-auto select-none cursor-default">{t('config.service.homepage')}</span>
        }
      >
        <Button
          onPress={() => {
            openUrl(pluginList[name].homepage)
          }}
        >
          {t('config.service.homepage')}
        </Button>
      </ConfigItem>
      {pluginConfig && (
        <ProviderConfigForm
          instanceKey={instanceKey}
          config={pluginConfig}
          setConfig={setPluginConfig}
          updateServiceList={updateServiceList}
          onClose={onClose}
        >
          <InstanceNameInput
            value={
              typeof configuredInstanceName === 'string'
                ? configuredInstanceName
                : pluginList[name].display
            }
            mainWrapperClassName="max-w-[60%]"
            onValueChange={(value) => {
              void setPluginConfig({
                ...pluginConfig,
                [INSTANCE_NAME_CONFIG_KEY]: value,
              })
            }}
          />

          {pluginNeeds.length === 0 ? (
            <div>{t('services.no_need')}</div>
          ) : (
            pluginNeeds.map((x) => {
              const options = x.options ?? {}
              const selectedOptionKey = Object.prototype.hasOwnProperty.call(pluginConfig, x.key)
                ? String(pluginConfig[x.key])
                : Object.keys(options)[0]

              return x.type ? (
                <ConfigItem
                  key={x.key}
                  title={<span className="my-auto select-none cursor-default">{x.display}</span>}
                >
                  {x.type === 'input' && (
                    <Input
                      value={`${Object.prototype.hasOwnProperty.call(pluginConfig, x.key) ? pluginConfig[x.key] : ''}`}
                      variant="bordered"
                      className="max-w-[60%]"
                      onValueChange={(value) => {
                        void setPluginConfig({
                          ...pluginConfig,
                          [x.key]: value,
                        })
                      }}
                    />
                  )}
                  {x.type === 'select' && (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="bordered" className="max-w-[60%]">
                          {options[selectedOptionKey]}
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label={x.key}
                        className="max-h-[40vh] overflow-y-auto"
                        onAction={(key) => {
                          void setPluginConfig({
                            ...pluginConfig,
                            [x.key]: key,
                          })
                        }}
                      >
                        {Object.keys(options).map((y) => {
                          return <DropdownItem key={y}>{options[y]}</DropdownItem>
                        })}
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </ConfigItem>
              ) : (
                <ConfigItem
                  key={x.key}
                  title={<span className="my-auto select-none cursor-default">{x.display}</span>}
                >
                  <Input
                    value={`${Object.prototype.hasOwnProperty.call(pluginConfig, x.key) ? pluginConfig[x.key] : ''}`}
                    variant="bordered"
                    className="max-w-[60%]"
                    onValueChange={(value) => {
                      void setPluginConfig({
                        ...pluginConfig,
                        [x.key]: value,
                      })
                    }}
                  />
                </ConfigItem>
              )
            })
          )}
        </ProviderConfigForm>
      )}
    </>
  )
}
