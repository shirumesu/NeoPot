import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { DropdownTrigger } from '@heroui/react'
import { Input, Button } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '@heroui/react'
import { useState } from 'react'

import { useConfig } from '../../../hooks/useConfig'
import { useToastStyle } from '../../../hooks'
import { translate } from './index'
import { Language } from './index'
import { useConfigSave } from '@/renderer/windows/Config/hooks/useConfigSave'
import {
  createDefaultDeepLConfig,
  getDeepLConfigFieldVisibility,
  isDeepLServiceType,
  normalizeDeepLConfig,
  type DeepLConfig,
} from '@/shared/deeplConfig'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'

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

  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()
  const updateDeeplConfig = (nextConfig: DeepLConfig) =>
    setRawDeeplConfig(normalizeDeepLConfig(nextConfig, defaultInstanceName))
  const fieldVisibility =
    deeplConfig === null ? null : getDeepLConfigFieldVisibility(deeplConfig.type)

  return (
    deeplConfig !== null &&
    fieldVisibility !== null && (
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const normalizedConfig = normalizeDeepLConfig(deeplConfig, defaultInstanceName)
          const saved = await saveConfig(instanceKey, null, setRawDeeplConfig, normalizedConfig, {
            compareCurrent: false,
            verify: true,
          })
          if (saved) {
            await updateServiceList(instanceKey)
            onClose()
          }
        }}
      >
        <div className="config-item">
          <Input
            label={t('services.instance_name')}
            labelPlacement="outside-left"
            value={deeplConfig[INSTANCE_NAME_CONFIG_KEY]}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              updateDeeplConfig({
                ...deeplConfig,
                [INSTANCE_NAME_CONFIG_KEY]: value,
              })
            }}
          />
        </div>
        <div className="config-item">
          <h3 className="my-auto pl-2">{t('services.translate.deepl.type')}</h3>
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
        </div>
        {fieldVisibility.authApiAuthKey && (
          <div className="config-item">
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
          </div>
        )}
        {fieldVisibility.deeplxAuthKey && (
          <div className="config-item">
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
          </div>
        )}
        {fieldVisibility.deeplxCustomUrl && (
          <div className="config-item">
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
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            onPress={() => {
              setIsLoading(true)
              translate('hello', Language.auto, Language.zh_cn, {
                config: normalizeDeepLConfig(deeplConfig, defaultInstanceName),
              }).then(
                () => {
                  setIsLoading(false)
                  toast.success(t('config.service.test_success'), { style: toastStyle })
                },
                (e) => {
                  setIsLoading(false)
                  toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle })
                },
              )
            }}
            isLoading={isLoading}
            fullWidth
          >
            {t('common.test')}
          </Button>
          <Button type="submit" isLoading={isLoading} color="primary" fullWidth>
            {t('common.save')}
          </Button>
        </div>
      </form>
    )
  )
}
