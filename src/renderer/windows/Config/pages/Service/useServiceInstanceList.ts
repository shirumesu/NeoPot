import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

import { deleteKey, isSameConfigValue, useConfig, useToastStyle } from '../../../../hooks'
import { useConfigSave } from '../../hooks/useConfigSave'

interface UseServiceInstanceListOptions {
  configKey: string
  defaultList: string[]
  protectLastService?: boolean
}

export function useServiceInstanceList(options: UseServiceInstanceListOptions) {
  const { configKey, defaultList, protectLastService = false } = options
  const [serviceInstanceList, setServiceInstanceList] = useConfig<string[]>(configKey, defaultList)
  const { t } = useTranslation()
  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  const deleteServiceInstance = async (instanceKey: string) => {
    if (serviceInstanceList === null) {
      return
    }
    if (protectLastService && serviceInstanceList.length === 1) {
      toast.error(t('config.service.least'), { style: toastStyle })
      return
    }

    const newList = serviceInstanceList.filter((x) => x !== instanceKey)
    const saved = await saveConfig(configKey, serviceInstanceList, setServiceInstanceList, newList)
    if (saved) {
      await deleteKey(instanceKey)
    }
  }

  const updateServiceInstanceList = async (instanceKey: string) => {
    if (serviceInstanceList === null || serviceInstanceList.includes(instanceKey)) {
      return
    }

    const newList = [...serviceInstanceList, instanceKey]
    await saveConfig(configKey, serviceInstanceList, setServiceInstanceList, newList, {
      notify: false,
    })
  }

  const handleServiceReorder = (nextServiceInstanceList: string[]) => {
    if (
      serviceInstanceList === null ||
      isSameConfigValue(serviceInstanceList, nextServiceInstanceList)
    ) {
      return
    }

    void saveConfig(
      configKey,
      serviceInstanceList,
      setServiceInstanceList,
      nextServiceInstanceList,
      {
        notify: false,
      },
    )
  }

  return {
    serviceInstanceList,
    deleteServiceInstance,
    updateServiceInstanceList,
    handleServiceReorder,
  }
}
