// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import type {
  NeoPotElectronApi,
  UpdateCheckResult,
  UpdateEvent,
  UpdateMode,
  UpdateStatus,
} from '../../src/shared/types/electron-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUpdaterController } from '../../src/renderer/windows/Updater/useUpdaterController'

const updaterMock = vi.hoisted(() => {
  const state: { listener?: (event: unknown) => void } = {}
  const unsubscribe = vi.fn()

  return {
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    onEvent: vi.fn((listener: (event: unknown) => void) => {
      state.listener = listener
      return unsubscribe
    }),
    openReleasePage: vi.fn(),
    state,
    unsubscribe,
  }
})

vi.mock('@/renderer/lib/electron/compat/updater', () => ({
  check: updaterMock.check,
  download: updaterMock.download,
  install: updaterMock.install,
  onEvent: updaterMock.onEvent,
  openReleasePage: updaterMock.openReleasePage,
}))

let startupListener: ((payload: unknown) => void) | undefined
const startupUnsubscribe = vi.fn()
const startupOnEvent = vi.fn((eventId: string, listener: (payload: unknown) => void) => {
  if (eventId === 'startup_update_available') {
    startupListener = listener
  }
  return startupUnsubscribe
})

beforeEach(() => {
  vi.clearAllMocks()
  updaterMock.state.listener = undefined
  updaterMock.check.mockResolvedValue(makeResult('not-available'))
  updaterMock.download.mockResolvedValue(undefined)
  updaterMock.install.mockResolvedValue(undefined)
  updaterMock.openReleasePage.mockResolvedValue(undefined)
  startupListener = undefined

  Object.defineProperty(window, 'neoPot', {
    configurable: true,
    value: {
      app: {
        onEvent: startupOnEvent,
      },
    } as unknown as NeoPotElectronApi,
  })
})

afterEach(cleanup)

function makeResult(status: UpdateStatus, mode: UpdateMode = 'self-update'): UpdateCheckResult {
  return {
    status,
    distribution: mode === 'manual-download' ? 'portable' : 'installer',
    mode,
    currentVersion: '1.1.5',
    version: status === 'available' ? '1.2.0' : undefined,
    message: status === 'error' ? 'Update failed.' : undefined,
  }
}

function emitUpdate(event: UpdateEvent) {
  const listener = updaterMock.state.listener as ((event: UpdateEvent) => void) | undefined
  if (!listener) {
    throw new Error('Updater controller did not subscribe to update events')
  }

  act(() => listener(event))
}

function emitStartup(result: UpdateCheckResult) {
  if (!startupListener) {
    throw new Error('Updater controller did not subscribe to startup updates')
  }

  act(() => startupListener?.(result))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('useUpdaterController state transitions', () => {
  it('moves from checking to latest and then available after completed refreshes', async () => {
    const latest = makeResult('not-available')
    const available = makeResult('available')
    const pendingCheck = deferred<UpdateCheckResult>()
    updaterMock.check.mockReturnValueOnce(pendingCheck.promise).mockResolvedValueOnce(available)
    const { result } = renderHook(() => useUpdaterController())

    let refreshPromise!: Promise<UpdateCheckResult | null>
    act(() => {
      refreshPromise = result.current.refresh()
    })

    expect(result.current.phase).toBe('checking')
    expect(result.current.isChecking).toBe(true)
    expect(result.current.primaryDisabled).toBe(true)

    await act(async () => {
      pendingCheck.resolve(latest)
      await refreshPromise
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.result).toEqual(latest)
    expect(result.current.primaryAction).toBe('check')

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.result).toEqual(available)
    expect(result.current.primaryAction).toBe('download')
  })

  it('does not retain a latest result when a later refresh fails', async () => {
    const onError = vi.fn()
    updaterMock.check
      .mockResolvedValueOnce(makeResult('not-available'))
      .mockRejectedValueOnce(new Error('Network unavailable.'))
    const { result } = renderHook(() => useUpdaterController({ onError }))

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.result?.status).toBe('not-available')

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.result).toBeNull()
    expect(result.current.message).toBe('Network unavailable.')
    expect(onError).toHaveBeenCalledWith('Network unavailable.')
  })

  it('handles downloading, ready, error, and unsupported update events without stale state', () => {
    const onError = vi.fn()
    const available = makeResult('available')
    const unsupported = makeResult('unsupported', 'manual-download')
    const { result } = renderHook(() => useUpdaterController({ onError }))

    emitUpdate({ type: 'checking' })
    expect(result.current.phase).toBe('checking')

    emitUpdate({
      type: 'download-progress',
      progress: { percent: 42, transferred: 420, total: 1000 },
    })
    expect(result.current.phase).toBe('downloading')
    expect(result.current.progress?.percent).toBe(42)

    emitUpdate({ type: 'downloaded', result: available })
    expect(result.current.phase).toBe('ready-restart')
    expect(result.current.primaryAction).toBe('install')

    emitUpdate({ type: 'error', message: 'Download interrupted.' })
    expect(result.current.phase).toBe('idle')
    expect(result.current.result).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.message).toBe('Download interrupted.')
    expect(onError).toHaveBeenCalledWith('Download interrupted.')

    emitUpdate({ type: 'unsupported', result: unsupported })
    expect(result.current.result).toEqual(unsupported)
    expect(result.current.primaryAction).toBe('open-release-page')
  })

  it('accepts startup availability and cleans up both event subscriptions on unmount', () => {
    const available = makeResult('available')
    const { result, unmount } = renderHook(() => useUpdaterController())

    expect(startupOnEvent).toHaveBeenCalledWith('startup_update_available', expect.any(Function))

    emitStartup(available)
    expect(result.current.result).toEqual(available)

    unmount()
    expect(updaterMock.unsubscribe).toHaveBeenCalledOnce()
    expect(startupUnsubscribe).toHaveBeenCalledOnce()
  })
})

describe('useUpdaterController primary actions', () => {
  it('opens the release page for manual updates and downloads then installs self-updates', async () => {
    const manual = makeResult('available', 'manual-download')
    const selfUpdate = makeResult('available', 'self-update')
    const { result } = renderHook(() => useUpdaterController())

    emitUpdate({ type: 'available', result: manual })
    expect(result.current.primaryAction).toBe('open-release-page')
    await act(async () => {
      await result.current.runPrimaryAction()
    })
    expect(updaterMock.openReleasePage).toHaveBeenCalledOnce()
    expect(updaterMock.download).not.toHaveBeenCalled()

    emitUpdate({ type: 'available', result: selfUpdate })
    expect(result.current.primaryAction).toBe('download')
    await act(async () => {
      await result.current.runPrimaryAction()
    })
    expect(updaterMock.download).toHaveBeenCalledOnce()
    expect(result.current.phase).toBe('downloading')

    emitUpdate({ type: 'downloaded', result: selfUpdate })
    expect(result.current.primaryAction).toBe('install')
    await act(async () => {
      await result.current.runPrimaryAction()
    })
    expect(updaterMock.install).toHaveBeenCalledOnce()
    expect(result.current.phase).toBe('installing')
  })
})
