import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { useConfig } from '@/renderer/hooks/useConfig'
import { useToastStyle } from '@/renderer/hooks'
import { useConfigSave } from '@/renderer/windows/Config/hooks/useConfigSave'
import { Button, Input } from '@heroui/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { DEFAULT_LINGVA_URL, tts } from './index'
import { Language } from './info'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'

interface LingvaConfig {
  [INSTANCE_NAME_CONFIG_KEY]: string
  custom_url: string
}

export function Config(props: ServiceConfigComponentProps) {
  const { instanceKey, updateServiceList, onClose } = props
  const { t } = useTranslation()
  const [config, setConfig] = useConfig<LingvaConfig>(
    instanceKey,
    {
      [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.lingva.title'),
      custom_url: DEFAULT_LINGVA_URL,
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
        <div className="config-item">
          <Input
            label={t('services.tts.lingva.custom_url')}
            labelPlacement="outside-left"
            value={config.custom_url}
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
        <div className="mb-3 rounded-medium border border-default-200 bg-content2 px-3 py-2 text-sm text-default-600">
          {t('services.tts.lingva.description')}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onPress={() => {
              setIsLoading(true)
              tts('Hello, this is a Lingva voice test.', Language.en, { config }).then(
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
