import { SetStateAction, useCallback } from 'react'
import { PrimitiveAtom, useAtom } from 'jotai'

import { useGetState } from './useGetState'

export const useSyncAtom = <T>(
  atom: PrimitiveAtom<T>,
): [T, (value: SetStateAction<T>, forceSync?: boolean) => void, (nextValue?: T) => void] => {
  const [atomValue, setAtomValue] = useAtom(atom)
  const [localValue, setLocalValue, getLocalValue] = useGetState<T>(atomValue as T)

  const syncAtom = (nextValue?: T) => setAtomValue((nextValue ?? getLocalValue()) as T)
  const setLocalValueWithOptionalSync = useCallback(
    (value: SetStateAction<T>, forceSync?: boolean) => {
      if (!forceSync) {
        setLocalValue(value)
        return
      }

      const nextValue =
        typeof value === 'function'
          ? (value as (previousValue: T | undefined) => T)(getLocalValue())
          : value
      setLocalValue(nextValue)
      setAtomValue(nextValue as T)
    },
    [getLocalValue, setAtomValue, setLocalValue],
  )

  return [localValue, setLocalValueWithOptionalSync, syncAtom]
}
