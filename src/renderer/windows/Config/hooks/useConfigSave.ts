import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { isSameConfigValue } from '@/renderer/hooks/useConfig'
import { useToastStyle } from '@/renderer/hooks'
import { getStoreValue } from '@/renderer/lib/config/store'
import { logger } from '@/renderer/lib/logger'

type ConfigSetter<T> = (value: T, forceSync?: boolean) => Promise<void>

interface SaveConfigOptions {
  compareCurrent?: boolean
  notify?: boolean
  successMessage?: string
  verify?: boolean
}

export function useConfigSave() {
  const { t } = useTranslation()
  const toastStyle = useToastStyle()

  const verifySavedConfig = useCallback(async (key: string, value: unknown) => {
    const savedValue = await getStoreValue(key)
    if (!isSameConfigValue(savedValue, value)) {
      throw new Error(`Config "${key}" was not saved`)
    }

    logger.debug('Config value verified after settings-page save.', {
      key,
    })
  }, [])

  const saveConfig = useCallback(
    async <T>(
      key: string,
      currentValue: T | null,
      setter: ConfigSetter<T>,
      nextValue: T,
      options: SaveConfigOptions = {},
    ) => {
      const { compareCurrent = true, notify = true, successMessage, verify = false } = options
      if (compareCurrent && isSameConfigValue(currentValue, nextValue)) {
        return true
      }

      try {
        logger.info('Config value save requested from settings page.', {
          key,
        })
        await setter(nextValue, true)
        if (verify) {
          await verifySavedConfig(key, nextValue)
        }
        logger.info('Config value saved from settings page.', {
          key,
        })
        if (notify) {
          toast.success(successMessage ?? t('config.common.save_success'), {
            duration: 1500,
            style: toastStyle,
          })
        }
        return true
      } catch (error) {
        logger.error('Config value save failed from settings page.', error, {
          key,
        })
        if (notify) {
          toast.error(t('config.common.save_failed'), {
            duration: 3000,
            style: toastStyle,
          })
        }
        return false
      }
    },
    [t, toastStyle, verifySavedConfig],
  )

  return {
    saveConfig,
    verifySavedConfig,
  }
}
