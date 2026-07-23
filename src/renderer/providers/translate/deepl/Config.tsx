import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { DropdownTrigger } from '@heroui/react'
import { Input, Button } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '@heroui/react'
import { useState } from 'react'

import { useConfig } from '../../../hooks/useConfig'
import { translate } from './index'
import { Language } from './index'
import {
  createDefaultDeepLConfig,
  getDeepLConfigFieldVisibility,
  isDeepLServiceType,
  normalizeDeepLConfig,
  type DeepLConfig,
} from '@/shared/deeplConfig'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import TestButton from '@/renderer/windows/Config/pages/Service/TestButton'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'
import ConfigItem from '@/renderer/windows/Config/components/ConfigItem'

export function Config(props: ServiceConfigComponentProps) {
  const { instanceKey, updateServiceList, onClose } = props
  const { t } = useTranslation()
  const defaultInstanceName = t('services.translate.deepl.title')
  const [rawDeeplConfig, setRawDeeplConfig] = useConfig<DeepLConfig>(
    instanceKey,
    createDefaultDeepLConfig(defaultInstanceName),
    { sync: false },
  )
  const deeplConfig =
    rawDeeplConfig === null ? null : normalizeDeepLConfig(rawDeeplConfig, defaultInstanceName)
  const [isLoading, setIsLoading] = useState(false)

  const updateDeeplConfig = (nextConfig: DeepLConfig) =>
    setRawDeeplConfig(normalizeDeepLConfig(nextConfig, defaultInstanceName))
  const fieldVisibility =
    deeplConfig === null ? null : getDeepLConfigFieldVisibility(deeplConfig.type)

  return (
    deeplConfig !== null &&
    fieldVisibility !== null && (
      <ProviderConfigForm
        instanceKey={instanceKey}
        config={normalizeDeepLConfig(deeplConfig, defaultInstanceName)}
        setConfig={setRawDeeplConfig}
        updateServiceList={updateServiceList}
        onClose={onClose}
        isLoading={isLoading}
        verify
        testButton={
          <TestButton
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onTest={() =>
              translate('hello', Language.auto, Language.zh_cn, {
                config: normalizeDeepLConfig(deeplConfig, defaultInstanceName),
              })
            }
          />
        }
      >
        <InstanceNameInput
          value={deeplConfig[INSTANCE_NAME_CONFIG_KEY]}
          onValueChange={(value) => {
            void updateDeeplConfig({
              ...deeplConfig,
              [INSTANCE_NAME_CONFIG_KEY]: value,
            })
          }}
        />
        <ConfigItem
          title={<span className="my-auto pl-2">{t('services.translate.deepl.type')}</span>}
        >
          <div className="w-full max-w-[50%] flex justify-end">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered" className="min-w-24">
                  {t(`services.translate.deepl.${deeplConfig.type}`)}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                autoFocus="first"
                aria-label={t('services.translate.deepl.type')}
                onAction={(key) => {
                  const nextType = String(key)
                  if (!isDeepLServiceType(nextType)) {
                    return
                  }

                  updateDeeplConfig({
                    ...deeplConfig,
                    type: nextType,
                  })
                }}
              >
                <DropdownItem key="free">{t(`services.translate.deepl.free`)}</DropdownItem>
                <DropdownItem key="api">{t(`services.translate.deepl.api`)}</DropdownItem>
                <DropdownItem key="deeplx">{t(`services.translate.deepl.deeplx`)}</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </ConfigItem>
        {fieldVisibility.authApiAuthKey && (
          <ConfigItem>
            <Input
              label={t('services.translate.deepl.auth_key')}
              labelPlacement="outside-left"
              type="password"
              value={deeplConfig.authApi.authKey}
              variant="bordered"
              classNames={{
                base: 'justify-between',
                label: 'text-(length:--heroui-font-size-medium)',
                mainWrapper: 'max-w-[50%]',
              }}
              onValueChange={(value) => {
                updateDeeplConfig({
                  ...deeplConfig,
                  authApi: {
                    ...deeplConfig.authApi,
                    authKey: value,
                  },
                })
              }}
            />
          </ConfigItem>
        )}
        {fieldVisibility.deeplxAuthKey && (
          <ConfigItem>
            <Input
              label={t('services.translate.deepl.auth_key')}
              labelPlacement="outside-left"
              type="password"
              value={deeplConfig.deeplx.authKey}
              variant="bordered"
              classNames={{
                base: 'justify-between',
                label: 'text-(length:--heroui-font-size-medium)',
                mainWrapper: 'max-w-[50%]',
              }}
              onValueChange={(value) => {
                updateDeeplConfig({
                  ...deeplConfig,
                  deeplx: {
                    ...deeplConfig.deeplx,
                    authKey: value,
                  },
                })
              }}
            />
          </ConfigItem>
        )}
        {fieldVisibility.deeplxCustomUrl && (
          <ConfigItem>
            <Input
              label={t('services.translate.deepl.custom_url')}
              labelPlacement="outside-left"
              value={deeplConfig.deeplx.customUrl}
              variant="bordered"
              classNames={{
                base: 'justify-between',
                label: 'text-(length:--heroui-font-size-medium)',
                mainWrapper: 'max-w-[50%]',
              }}
              onValueChange={(value) => {
                updateDeeplConfig({
                  ...deeplConfig,
                  deeplx: {
                    ...deeplConfig.deeplx,
                    customUrl: value,
                  },
                })
              }}
            />
          </ConfigItem>
        )}
      </ProviderConfigForm>
    )
  )
}
