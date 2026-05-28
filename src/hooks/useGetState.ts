import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';

export const useGetState = <T>(
    initState: T
): [T, Dispatch<SetStateAction<T>>, () => T] => {
    const [state, setState] = useState(initState);
    const stateRef = useRef(state);
    stateRef.current = state;
    const setStateAndRef: Dispatch<SetStateAction<T>> = useCallback((nextState) => {
        setState((previousState) => {
            const resolvedState =
                typeof nextState === 'function'
                    ? (nextState as (previousState: T) => T)(previousState)
                    : nextState;
            stateRef.current = resolvedState;
            return resolvedState;
        });
    }, []);
    const getState = useCallback(() => stateRef.current, []);
    return [state, setStateAndRef, getState];
};
