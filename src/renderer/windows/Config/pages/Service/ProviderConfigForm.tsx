import type { FormEvent, ReactNode } from 'react'
import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useConfigSave } from '../../hooks/useConfigSave'

type ConfigSetter<T> = (value: T, forceSync?: boolean) => Promise<void>

interface ProviderConfigFormProps<T> {
  instanceKey: string
  config: T
  setConfig: ConfigSetter<T>
  updateServiceList: (key: string) => void | Promise<void>
  onClose: () => void
  children: ReactNode
  testButton?: ReactNode
  isLoading?: boolean
  verify?: boolean
}

export default function ProviderConfigForm<T>(props: ProviderConfigFormProps<T>) {
  const {
    instanceKey,
    config,
    setConfig,
    updateServiceList,
    onClose,
    children,
    testButton,
    isLoading = false,
    verify = false,
  } = props
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await saveConfig(instanceKey, null, setConfig, config, {
      compareCurrent: false,
      verify,
    })
    if (!saved) {
      return
    }

    await updateServiceList(instanceKey)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit}>
      {children}
      <div className="flex gap-2">
        {testButton}
        <Button type="submit" isLoading={isLoading} color="primary" fullWidth>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
