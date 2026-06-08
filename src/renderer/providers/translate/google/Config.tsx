import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { Input, Button } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'

import { useConfig } from '../../../hooks/useConfig'
import { useToastStyle } from '../../../hooks'
import { translate } from './index'
import { Language } from './index'
import { useConfigSave } from '@/renderer/windows/Config/hooks/useConfigSave'
import { DEFAULT_GOOGLE_TRANSLATE_URL } from '@/shared/providerUrl'

export function Config(props: any) {
  const { instanceKey, updateServiceList, onClose } = props
  const { t } = useTranslation()
  const [config, setConfig] = useConfig(
    instanceKey,
    {
      [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.google.title'),
      custom_url: DEFAULT_GOOGLE_TRANSLATE_URL,
    },
    { sync: false },
  )
  const [isLoading, setIsLoading] = useState(false)

  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  return (
    config !== null && (
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const saved = await saveConfig(instanceKey, null, setConfig, config, {
            compareCurrent: false,
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
            value={config[INSTANCE_NAME_CONFIG_KEY]}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setConfig({
                ...config,
                [INSTANCE_NAME_CONFIG_KEY]: value,
              })
            }}
          />
        </div>
        <div className={'config-item'}>
          <Input
            label={t('services.translate.google.custom_url')}
            labelPlacement="outside-left"
            value={config['custom_url']}
            variant="bordered"
            classNames={{
              base: 'justify-between',
              label: 'text-(length:--heroui-font-size-medium)',
              mainWrapper: 'max-w-[50%]',
            }}
            onValueChange={(value) => {
              setConfig({
                ...config,
                custom_url: value,
              })
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onPress={() => {
              setIsLoading(true)
              translate('hello', Language.auto, Language.zh_cn, { config }).then(
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
