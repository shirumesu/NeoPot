import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { useTranslation } from 'react-i18next'

import { useConfig } from '../../../hooks/useConfig'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'

export function Config(props: ServiceConfigComponentProps) {
  const { instanceKey, updateServiceList, onClose } = props
  const { t } = useTranslation()
  const [config, setConfig] = useConfig(
    instanceKey,
    {
      [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.local_model.title'),
    },
    { sync: false },
  )
  return (
    config !== null && (
      <ProviderConfigForm
        instanceKey={instanceKey}
        config={config}
        setConfig={setConfig}
        updateServiceList={updateServiceList}
        onClose={onClose}
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
        <div className="mb-3 rounded-medium border border-default-200 bg-content2 px-3 py-2 text-sm text-default-600">
          {t('services.recognize.local_model.description')}
        </div>
      </ProviderConfigForm>
    )
  )
}
