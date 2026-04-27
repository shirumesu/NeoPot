import { useCallback, useEffect, useRef } from 'react';

import { useGetState } from './useGetState';
import { debounce } from '../utils/index.js';
import {
    STORE_CHANGED_EVENT,
    STORE_RELOADED_EVENT,
    deleteStoreValue,
    emitStoreValueChanged,
    getStoreValue,
    setStoreValue,
} from '../utils/store.js';

interface UseConfigOptions {
    sync?: boolean;
}

export const useConfig = <T = unknown>(key: string, defaultValue: T, options: UseConfigOptions = {}) => {
    const [property, setPropertyState, getProperty] = useGetState(null) as [
        T | null,
        (value: T | null) => void,
        () => T | null
    ];
    const { sync = true } = options;
    const defaultValueRef = useRef(defaultValue);

    useEffect(() => {
        defaultValueRef.current = defaultValue;
    }, [defaultValue]);

    const syncToStore = useCallback(
        debounce((v: T) => {
            void setStoreValue(key, v)
                .then(() => {
                    emitStoreValueChanged(key, v);
                })
                .catch((error: unknown) => {
                    console.error(`Failed to save config key "${key}":`, error);
                });
        }),
        [key]
    );

    const syncToState = useCallback(
        (v: T | null) => {
            if (v !== null) {
                setPropertyState(v);
            } else {
                void getStoreValue(key)
                    .then((loadedValue) => {
                        const typedLoadedValue = loadedValue as T | null | undefined;
                        if (typedLoadedValue === undefined || typedLoadedValue === null) {
                            setPropertyState(defaultValueRef.current);
                        } else {
                            setPropertyState(typedLoadedValue);
                        }
                    })
                    .catch((error: unknown) => {
                        console.error(`Failed to read config key "${key}":`, error);
                        setPropertyState(defaultValueRef.current);
                    });
            }
        },
        [key, setPropertyState]
    );

    const setProperty = useCallback(
        (v: T, forceSync = false) => {
            setPropertyState(v);
            const isSync = forceSync || sync;
            if (isSync) {
                syncToStore(v);
            }
        },
        [setPropertyState, sync, syncToStore]
    );

    useEffect(() => {
        syncToState(null);

        const onStoreValueChanged = (event: Event) => {
            const detail = (event as CustomEvent<{ key: string; value: T }>).detail;
            if (detail.key === key) {
                syncToState(detail.value);
            }
        };

        const onStoreReloaded = () => {
            syncToState(null);
        };

        window.addEventListener(STORE_CHANGED_EVENT, onStoreValueChanged as EventListener);
        window.addEventListener(STORE_RELOADED_EVENT, onStoreReloaded);

        return () => {
            window.removeEventListener(STORE_CHANGED_EVENT, onStoreValueChanged as EventListener);
            window.removeEventListener(STORE_RELOADED_EVENT, onStoreReloaded);
        };
    }, [key, syncToState]);

    return [property, setProperty, getProperty] as const;
};

export const deleteKey = async (key: string) => {
    await deleteStoreValue(key);
};
