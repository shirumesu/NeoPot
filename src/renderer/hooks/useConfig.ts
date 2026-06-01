import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useGetState } from './useGetState'
import { debounce } from '@/renderer/lib'
import { logger } from '@/renderer/lib/logger'
import {
  STORE_CHANGED_EVENT,
  STORE_RELOADED_EVENT,
  deleteStoreValue,
  emitStoreValueChanged,
  getStoreValue,
  setStoreValue,
} from '@/renderer/lib/config/store'

interface UseConfigOptions {
  sync?: boolean
}

export const isSameConfigValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
    )
  }

  return false
}

const describeConfigValue = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    return {
      valueType: 'string',
      valueLength: value.length,
    }
  }

  if (Array.isArray(value)) {
    return {
      valueType: 'array',
      valueLength: value.length,
    }
  }

  return {
    valueType: value === null ? 'null' : typeof value,
  }
}

export const useConfig = <T = unknown>(
  key: string,
  defaultValue: T,
  options: UseConfigOptions = {},
) => {
  const [property, setPropertyState, getProperty] = useGetState(null) as [
    T | null,
    (value: T | null) => void,
    () => T | null,
  ]
  const { sync = true } = options
  const defaultValueRef = useRef(defaultValue)

  useEffect(() => {
    defaultValueRef.current = defaultValue
  }, [defaultValue])

  const persistStoreValue = useCallback(
    async (v: T) => {
      await setStoreValue(key, v)
      emitStoreValueChanged(key, v)
      logger.debug('Config value persisted.', {
        key,
        ...describeConfigValue(v),
      })
    },
    [key],
  )

  const syncToStore = useMemo(
    () =>
      debounce((v: T) => {
        void persistStoreValue(v).catch((error: unknown) => {
          logger.error('Failed to save config value.', error, {
            key,
          })
        })
      }),
    [key, persistStoreValue],
  )

  const setProperty = useCallback(
    (v: T, forceSync = false) => {
      if (isSameConfigValue(getProperty(), v)) {
        return Promise.resolve()
      }

      setPropertyState(v)
      const isSync = forceSync || sync
      const logContext = {
        key,
        sync: isSync,
        forceSync,
        ...describeConfigValue(v),
      }
      if (isSync) {
        logger.info('Config value changed.', logContext)
      } else {
        logger.debug('Config value changed locally.', logContext)
      }
      if (!isSync) {
        return Promise.resolve()
      }

      if (forceSync) {
        return persistStoreValue(v)
      }

      syncToStore(v)
      return Promise.resolve()
    },
    [getProperty, persistStoreValue, setPropertyState, sync, syncToStore],
  )

  const syncToState = useCallback(
    (v: T | null) => {
      if (v !== null) {
        if (!isSameConfigValue(getProperty(), v)) {
          setPropertyState(v)
        }
      } else {
        void getStoreValue(key)
          .then((loadedValue) => {
            const typedLoadedValue = loadedValue as T | null | undefined
            if (typedLoadedValue === undefined || typedLoadedValue === null) {
              setPropertyState(defaultValueRef.current)
            } else {
              setPropertyState(typedLoadedValue)
            }
          })
          .catch((error: unknown) => {
            logger.error('Failed to read config value.', error, {
              key,
            })
            setPropertyState(defaultValueRef.current)
          })
      }
    },
    [getProperty, key, setPropertyState],
  )

  useEffect(() => {
    syncToState(null)

    const onStoreValueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: T }>).detail
      if (detail.key === key) {
        syncToState(detail.value)
      }
    }

    const onStoreReloaded = () => {
      syncToState(null)
    }

    window.addEventListener(STORE_CHANGED_EVENT, onStoreValueChanged as EventListener)
    window.addEventListener(STORE_RELOADED_EVENT, onStoreReloaded)

    return () => {
      window.removeEventListener(STORE_CHANGED_EVENT, onStoreValueChanged as EventListener)
      window.removeEventListener(STORE_RELOADED_EVENT, onStoreReloaded)
    }
  }, [key, syncToState])

  return [property, setProperty, getProperty] as const
}

export const deleteKey = async (key: string) => {
  await deleteStoreValue(key)
}
