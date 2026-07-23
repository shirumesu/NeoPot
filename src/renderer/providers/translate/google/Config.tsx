import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { Input } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

import { useConfig } from '../../../hooks/useConfig'
import { translate } from './index'
import { Language } from './index'
import { DEFAULT_GOOGLE_TRANSLATE_URL } from '@/shared/providerUrl'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import TestButton from '@/renderer/windows/Config/pages/Service/TestButton'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'
import ConfigItem from '@/renderer/windows/Config/components/ConfigItem'

export function Config(props: ServiceConfigComponentProps) {
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
            onTest={() => translate('hello', Language.auto, Language.zh_cn, { config })}
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
              void setConfig({
                ...config,
                custom_url: value,
              })
            }}
          />
        </ConfigItem>
      </ProviderConfigForm>
    )
  )
}
