import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'

export function useGetState<T>(initState: T): [T, Dispatch<SetStateAction<T>>, () => T]
export function useGetState<T = undefined>(): [
  T | undefined,
  Dispatch<SetStateAction<T | undefined>>,
  () => T | undefined,
]
export function useGetState<T>(
  initState?: T,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>, () => T | undefined] {
  const [state, setState] = useState(initState)
  const stateRef = useRef(state)
  stateRef.current = state
  const setStateAndRef: Dispatch<SetStateAction<T | undefined>> = useCallback((nextState) => {
    setState((previousState) => {
      const resolvedState =
        typeof nextState === 'function'
          ? (nextState as (previousState: T | undefined) => T | undefined)(previousState)
          : nextState
      stateRef.current = resolvedState
      return resolvedState
    })
  }, [])
  const getState = useCallback(() => stateRef.current, [])
  return [state, setStateAndRef, getState]
}
