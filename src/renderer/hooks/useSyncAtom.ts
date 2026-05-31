import { SetStateAction } from 'react'
import { PrimitiveAtom, useAtom } from 'jotai'

import { useGetState } from './useGetState'

export const useSyncAtom = <T>(
  atom: PrimitiveAtom<T>,
): [T, (value: SetStateAction<T>, forceSync?: boolean) => void, (nextValue?: T) => void] => {
  const [atomValue, setAtomValue] = useAtom(atom)
  const [localValue, setLocalValue, getLocalValue] = useGetState(atomValue)

  const syncAtom = (nextValue?: T) => setAtomValue(nextValue ?? getLocalValue())

  return [localValue, setLocalValue, syncAtom]
}
