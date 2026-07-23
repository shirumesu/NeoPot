import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { useConfig } from '@/renderer/hooks/useConfig'
import { Input } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_LINGVA_URL, tts } from './index'
import { Language } from './info'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import TestButton from '@/renderer/windows/Config/pages/Service/TestButton'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'
import ConfigItem from '@/renderer/windows/Config/components/ConfigItem'

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

  return (
    config !== null && (
      <ProviderConfigForm
        instanceKey={instanceKey}
        config={config}
        setConfig={setConfig}
        updateServiceList={updateServiceList}
        onClose={onClose}
        isLoading={isLoading}
        testButton={
          <TestButton
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onTest={() =>
              tts('Hello, this is a Lingva voice test.', Language.en, {
                config,
              })
            }
          />
        }
      >
        <InstanceNameInput
          value={config[INSTANCE_NAME_CONFIG_KEY]}
          onValueChange={(value) => {
            void setConfig({
              ...config,
              [INSTANCE_NAME_CONFIG_KEY]: value,
            })
          }}
        />
        <ConfigItem>
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
              void setConfig({
                ...config,
                custom_url: value,
              })
            }}
          />
        </ConfigItem>
        <div className="mb-3 rounded-medium border border-default-200 bg-content2 px-3 py-2 text-sm text-default-600">
          {t('services.tts.lingva.description')}
        </div>
      </ProviderConfigForm>
    )
  )
}
