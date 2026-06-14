import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { Button, Input } from '@heroui/react'
import { DropdownTrigger } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { Dropdown } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { openUrl as open } from '@/renderer/lib/electron/compat/opener'

import { useConfig } from '../../../../../hooks'
import { useConfigSave } from '../../../hooks/useConfigSave'
import type { ServiceConfigComponentProps } from '../types'

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
  const { saveConfig } = useConfigSave()
  const pluginNeeds = (pluginList[name].needs as unknown[]).filter(isPluginNeed)
  const configuredInstanceName = pluginConfig?.[INSTANCE_NAME_CONFIG_KEY]

  return (
    <>
      <div className={'config-item'}>
        <h3 className="my-auto select-none cursor-default">{t('config.service.homepage')}</h3>
        <Button
          onPress={() => {
            open(pluginList[name].homepage)
          }}
        >
          {t('config.service.homepage')}
        </Button>
      </div>
      {pluginConfig && (
        <div className="config-item">
          <Input
            label={t('services.instance_name')}
            labelPlacement="outside-left"
            value={
              typeof configuredInstanceName === 'string'
                ? configuredInstanceName
                : pluginList[name].display
            }
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[60%]',
            }}
            onValueChange={(value) => {
              setPluginConfig({
                ...pluginConfig,
                [INSTANCE_NAME_CONFIG_KEY]: value,
              })
            }}
          />
        </div>
      )}

      {pluginNeeds.length === 0 ? (
        <div>{t('services.no_need')}</div>
      ) : (
        pluginNeeds.map((x) => {
          const options = x.options ?? {}
          const selectedOptionKey = Object.prototype.hasOwnProperty.call(pluginConfig ?? {}, x.key)
            ? String(pluginConfig?.[x.key])
            : Object.keys(options)[0]

          return (
            pluginConfig &&
            (x.type ? (
              <div key={x.key} className={`config-item`}>
                <h3 className="my-auto select-none cursor-default">{x.display}</h3>
                {x.type === 'input' && (
                  <Input
                    value={`${Object.prototype.hasOwnProperty.call(pluginConfig, x.key) ? pluginConfig[x.key] : ''}`}
                    variant="bordered"
                    className="max-w-[60%]"
                    onValueChange={(value) => {
                      setPluginConfig({
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
                        setPluginConfig({
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
              </div>
            ) : (
              <div key={x.key} className={`config-item`}>
                <h3 className="my-auto select-none cursor-default">{x.display}</h3>
                <Input
                  value={`${Object.prototype.hasOwnProperty.call(pluginConfig, x.key) ? pluginConfig[x.key] : ''}`}
                  variant="bordered"
                  className="max-w-[60%]"
                  onValueChange={(value) => {
                    setPluginConfig({
                      ...pluginConfig,
                      [x.key]: value,
                    })
                  }}
                />
              </div>
            ))
          )
        })
      )}

      <div>
        <Button
          fullWidth
          color="primary"
          onPress={async () => {
            if (pluginConfig === null) {
              return
            }

            const saved = await saveConfig(instanceKey, null, setPluginConfig, pluginConfig, {
              compareCurrent: false,
            })
            if (saved) {
              await updateServiceList(instanceKey)
              onClose()
            }
          }}
        >
          {t('common.save')}
        </Button>
      </div>
    </>
  )
}
