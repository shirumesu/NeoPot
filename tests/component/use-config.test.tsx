// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeMock = vi.hoisted(() => ({
  getStoreValue: vi.fn(),
  setStoreValue: vi.fn(),
  deleteStoreValue: vi.fn(),
}))

const debounceMock = vi.hoisted(() => {
  let pending: (() => void) | null = null
  return {
    debounce: <TArgs extends unknown[]>(fn: (...args: TArgs) => void) => {
      return (...args: TArgs) => {
        pending = () => fn(...args)
      }
    },
    flush: () => {
      const next = pending
      pending = null
      next?.()
    },
    reset: () => {
      pending = null
    },
  }
})

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/renderer/lib/config/store', () => ({
  STORE_CHANGED_EVENT: 'neopot:store-changed',
  STORE_RELOADED_EVENT: 'neopot:store-reloaded',
  deleteStoreValue: storeMock.deleteStoreValue,
  getStoreValue: storeMock.getStoreValue,
  setStoreValue: storeMock.setStoreValue,
}))
vi.mock('@/renderer/lib', () => ({
  debounce: debounceMock.debounce,
}))
vi.mock('@/renderer/lib/logger', () => ({
  logger: loggerMock,
}))

import { deleteKey, isSameConfigValue, useConfig } from '../../src/renderer/hooks/useConfig'

beforeEach(() => {
  vi.clearAllMocks()
  debounceMock.reset()
  storeMock.getStoreValue.mockResolvedValue(undefined)
  storeMock.setStoreValue.mockResolvedValue(undefined)
  storeMock.deleteStoreValue.mockResolvedValue(true)
})

afterEach(cleanup)

describe('useConfig initial and external state', () => {
  it('loads persisted data and falls back to the latest default for missing values', async () => {
    storeMock.getStoreValue
      .mockResolvedValueOnce({ mode: 'saved' })
      .mockResolvedValueOnce(undefined)
    const saved = renderHook(() => useConfig('panel', { mode: 'default' }))

    await waitFor(() => expect(saved.result.current[0]).toEqual({ mode: 'saved' }))
    saved.unmount()

    const missing = renderHook(() => useConfig('panel', { mode: 'new-default' }))
    await waitFor(() => expect(missing.result.current[0]).toEqual({ mode: 'new-default' }))
  })

  it('uses the default and logs when the initial read fails', async () => {
    storeMock.getStoreValue.mockRejectedValueOnce(new Error('read failed'))
    const { result } = renderHook(() => useConfig('theme', 'system'))

    await waitFor(() => expect(result.current[0]).toBe('system'))
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to read config value.',
      expect.any(Error),
      { key: 'theme' },
    )
  })

  it('applies value-carrying events immediately and reloads key-only events from storage', async () => {
    storeMock.getStoreValue.mockResolvedValueOnce('initial').mockResolvedValueOnce('reloaded')
    const { result } = renderHook(() => useConfig('theme', 'system'))
    await waitFor(() => expect(result.current[0]).toBe('initial'))

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neopot:store-changed', {
          detail: { key: 'theme', value: 'dark' },
        }),
      )
      window.dispatchEvent(
        new CustomEvent('neopot:store-changed', {
          detail: { key: 'unrelated', value: 'ignored' },
        }),
      )
    })
    expect(result.current[0]).toBe('dark')

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neopot:store-changed', {
          detail: { key: 'theme' },
        }),
      )
    })
    await waitFor(() => expect(result.current[0]).toBe('reloaded'))
    expect(storeMock.getStoreValue).toHaveBeenCalledTimes(2)
  })

  it('reloads the active key when the complete store is reloaded', async () => {
    storeMock.getStoreValue.mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    const { result } = renderHook(() => useConfig('language', 'en'))
    await waitFor(() => expect(result.current[0]).toBe('first'))

    act(() => {
      window.dispatchEvent(new CustomEvent('neopot:store-reloaded'))
    })

    await waitFor(() => expect(result.current[0]).toBe('second'))
  })
})

describe('useConfig persistence behavior', () => {
  it('updates local state immediately and debounces persistence to the latest value', async () => {
    const { result } = renderHook(() => useConfig('font_size', 14))
    await waitFor(() => expect(result.current[0]).toBe(14))

    act(() => {
      void result.current[1](15)
      void result.current[1](16)
    })

    expect(result.current[0]).toBe(16)
    expect(storeMock.setStoreValue).not.toHaveBeenCalled()

    act(() => debounceMock.flush())
    await waitFor(() => expect(storeMock.setStoreValue).toHaveBeenCalledWith('font_size', 16))
    expect(storeMock.setStoreValue).toHaveBeenCalledOnce()
  })

  it('keeps draft values local until a force-sync commit', async () => {
    const { result } = renderHook(() => useConfig('draft', 'initial', { sync: false }))
    await waitFor(() => expect(result.current[0]).toBe('initial'))

    await act(async () => {
      await result.current[1]('edited')
    })
    expect(result.current[0]).toBe('edited')
    expect(storeMock.setStoreValue).not.toHaveBeenCalled()

    await act(async () => {
      await result.current[1]('edited', true)
    })
    expect(storeMock.setStoreValue).toHaveBeenCalledWith('draft', 'edited')
  })

  it('skips equal values unless force-sync is explicitly requested', async () => {
    storeMock.getStoreValue.mockResolvedValueOnce({ enabled: true, optional: undefined })
    const { result } = renderHook(() => useConfig('feature', { enabled: false }))
    await waitFor(() => expect(result.current[0]).toEqual({ enabled: true, optional: undefined }))

    await act(async () => {
      await result.current[1]({ enabled: true })
    })
    act(() => debounceMock.flush())
    expect(storeMock.setStoreValue).not.toHaveBeenCalled()

    await act(async () => {
      await result.current[1]({ enabled: true }, true)
    })
    expect(storeMock.setStoreValue).toHaveBeenCalledWith('feature', { enabled: true })
  })

  it('surfaces force-sync failures to the caller while debounced failures are logged', async () => {
    storeMock.setStoreValue.mockRejectedValue(new Error('write failed'))
    const { result } = renderHook(() => useConfig('theme', 'system'))
    await waitFor(() => expect(result.current[0]).toBe('system'))

    await expect(
      act(async () => {
        await result.current[1]('dark', true)
      }),
    ).rejects.toThrow('write failed')

    act(() => {
      void result.current[1]('light')
      debounceMock.flush()
    })
    await waitFor(() =>
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to save config value.',
        expect.any(Error),
        { key: 'theme' },
      ),
    )
  })

  it('deletes config through the shared store boundary', async () => {
    await deleteKey('obsolete')
    expect(storeMock.deleteStoreValue).toHaveBeenCalledWith('obsolete')
  })
})

describe('isSameConfigValue', () => {
  it('compares nested arrays and objects while treating undefined object fields as absent', () => {
    expect(
      isSameConfigValue(
        { services: [{ name: 'ollama', options: { stream: true, unused: undefined } }] },
        { services: [{ name: 'ollama', options: { stream: true } }] },
      ),
    ).toBe(true)
    expect(isSameConfigValue([1, 2], [2, 1])).toBe(false)
    expect(isSameConfigValue({ enabled: true }, { enabled: false })).toBe(false)
  })
})
