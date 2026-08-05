import { INSTANCE_NAME_CONFIG_KEY } from '@/renderer/lib/service/service_instance'
import { Button, Dropdown, DropdownItem, DropdownTrigger } from '@heroui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { useConfig } from '../../../hooks/useConfig'
import type { ServiceConfigComponentProps } from '@/renderer/windows/Config/pages/Service/types'
import ProviderConfigForm from '@/renderer/windows/Config/pages/Service/ProviderConfigForm'
import InstanceNameInput from '@/renderer/windows/Config/pages/Service/InstanceNameInput'
import SafeDropdownMenu from '@/renderer/components/SafeDropdownMenu'
import ConfigItem from '@/renderer/windows/Config/components/ConfigItem'
import { useConfigSave } from '@/renderer/windows/Config/hooks/useConfigSave'
import {
  COMPUTE_BACKENDS,
  COMPUTE_BACKEND_CONFIG_KEY,
  DEFAULT_COMPUTE_BACKEND,
  DEFAULT_MODEL_VARIANT,
  MODEL_VARIANT_CONFIG_KEY,
  MODEL_VARIANTS,
  type ComputeBackend,
  type ModelVariant,
} from './modelAssets'

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
  const [modelVariant, setModelVariant] = useConfig<ModelVariant>(
    MODEL_VARIANT_CONFIG_KEY,
    DEFAULT_MODEL_VARIANT,
  )
  const [computeBackend, setComputeBackend] = useConfig<ComputeBackend>(
    COMPUTE_BACKEND_CONFIG_KEY,
    DEFAULT_COMPUTE_BACKEND,
  )
  const { saveConfig } = useConfigSave()
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
        {modelVariant !== null && (
          <ConfigItem title={t('services.recognize.local_model.model_variant')}>
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered">
                  {t(`services.recognize.local_model.model_variants.${modelVariant}`)}
                </Button>
              </DropdownTrigger>
              <SafeDropdownMenu
                aria-label={t('services.recognize.local_model.model_variant')}
                onAction={(key: React.Key) => {
                  void saveConfig(
                    MODEL_VARIANT_CONFIG_KEY,
                    modelVariant,
                    setModelVariant,
                    key as ModelVariant,
                    { notify: false },
                  )
                }}
              >
                {MODEL_VARIANTS.map((variant) => (
                  <DropdownItem key={variant}>
                    {t(`services.recognize.local_model.model_variants.${variant}`)}
                  </DropdownItem>
                ))}
              </SafeDropdownMenu>
            </Dropdown>
          </ConfigItem>
        )}
        {computeBackend !== null && (
          <ConfigItem title={t('services.recognize.local_model.compute_backend')}>
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered">
                  {t(`services.recognize.local_model.compute_backends.${computeBackend}`)}
                </Button>
              </DropdownTrigger>
              <SafeDropdownMenu
                aria-label={t('services.recognize.local_model.compute_backend')}
                onAction={(key: React.Key) => {
                  void saveConfig(
                    COMPUTE_BACKEND_CONFIG_KEY,
                    computeBackend,
                    setComputeBackend,
                    key as ComputeBackend,
                    { notify: false },
                  )
                }}
              >
                {COMPUTE_BACKENDS.map((backend) => (
                  <DropdownItem key={backend}>
                    {t(`services.recognize.local_model.compute_backends.${backend}`)}
                  </DropdownItem>
                ))}
              </SafeDropdownMenu>
            </Dropdown>
          </ConfigItem>
        )}
      </ProviderConfigForm>
    )
  )
}
