import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  readText: vi.fn(),
}))

const workflowMock = vi.hoisted(() => ({
  selectionTranslate: vi.fn(),
}))

const selectionMock = vi.hoisted(() => ({
  getSelectionClipboardCaptureBaseline: vi.fn(() => ({ version: 0, text: null })),
  isSelectionClipboardCaptureActive: vi.fn(() => false),
}))

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('electron', () => ({
  clipboard: { readText: electronMock.readText },
}))
vi.mock('../../src/main/modules/workflow', () => workflowMock)
vi.mock('../../src/main/modules/selection', () => selectionMock)
vi.mock('../../src/main/logger', () => ({ logger: loggerMock }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  electronMock.readText.mockReturnValue('initial')
  workflowMock.selectionTranslate.mockResolvedValue(undefined)
})

describe('clipboard monitor lifecycle', () => {
  it('owns no polling interval while monitoring is disabled', async () => {
    const monitor = await import('../../src/main/modules/clipboard')

    monitor.setClipboardMonitorEnabled(true)
    expect(vi.getTimerCount()).toBe(1)

    monitor.setClipboardMonitorEnabled(false)
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(electronMock.readText).toHaveBeenCalledOnce()
    expect(workflowMock.selectionTranslate).not.toHaveBeenCalled()
  })

  it('resumes polling when re-enabled and translates a new clipboard value once', async () => {
    const monitor = await import('../../src/main/modules/clipboard')

    monitor.setClipboardMonitorEnabled(false)
    monitor.setClipboardMonitorEnabled(true)
    electronMock.readText.mockReturnValue('updated')
    await vi.advanceTimersByTimeAsync(500)

    expect(workflowMock.selectionTranslate).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(500)
    expect(workflowMock.selectionTranslate).toHaveBeenCalledOnce()
  })

  it('clears the polling interval after a clipboard read failure', async () => {
    const monitor = await import('../../src/main/modules/clipboard')

    monitor.setClipboardMonitorEnabled(true)
    electronMock.readText.mockImplementation(() => {
      throw new Error('clipboard unavailable')
    })
    await vi.advanceTimersByTimeAsync(500)

    expect(vi.getTimerCount()).toBe(0)
    expect(loggerMock.warn).toHaveBeenCalledWith('Clipboard monitor paused after failure.', {
      error: 'clipboard unavailable',
    })
  })

  it('does not create an interval when the initial clipboard read fails', async () => {
    electronMock.readText.mockImplementation(() => {
      throw new Error('clipboard unavailable')
    })
    const monitor = await import('../../src/main/modules/clipboard')

    monitor.setClipboardMonitorEnabled(true)

    expect(vi.getTimerCount()).toBe(0)
    expect(loggerMock.warn).toHaveBeenCalledWith('Clipboard monitor could not start.', {
      error: 'clipboard unavailable',
    })
  })
})
