import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => {
  let text = ''

  return {
    readText: vi.fn(() => text),
    writeText: vi.fn((nextText: string) => {
      text = nextText
    }),
    setText(nextText: string) {
      text = nextText
    },
  }
})

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn(),
}))

vi.mock('electron', () => ({
  clipboard: {
    readText: electronMock.readText,
    writeText: electronMock.writeText,
  },
}))

vi.mock('node:child_process', () => ({
  execFile: childProcessMock.execFile,
}))

vi.mock('../../src/main/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

type ExecFileCallback = (
  error: Error | null,
  result?: {
    stdout: string
    stderr: string
  },
) => void

function setWindowsPlatform() {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: 'win32',
  })
}

function isUiaCommand(args: unknown[]): boolean {
  return args.some((value) => typeof value === 'string' && value.includes('UIAutomationClient'))
}

function isSendKeysCommand(args: unknown[]): boolean {
  return args.some((value) => typeof value === 'string' && value.includes('SendKeys'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  electronMock.setText('clipboard before capture')
  setWindowsPlatform()
})

afterEach(() => {
  vi.useRealTimers()
  if (platformDescriptor) {
    Object.defineProperty(process, 'platform', platformDescriptor)
  }
})

describe('Windows selected-text capture', () => {
  it('cancels the clipboard fallback before delayed Ctrl+C when UIA succeeds', async () => {
    childProcessMock.execFile.mockImplementation(
      (_file: string, args: unknown[], _options: unknown, callback: ExecFileCallback) => {
        if (isUiaCommand(args)) {
          setTimeout(() => callback(null, { stdout: 'selected by UIA', stderr: '' }), 40)
        } else {
          callback(null, { stdout: '', stderr: '' })
        }
      },
    )

    const { readSelectedText } = await import('../../src/main/modules/selection')
    const capture = readSelectedText()
    await vi.advanceTimersByTimeAsync(40)

    await expect(capture).resolves.toEqual({
      ok: true,
      text: 'selected by UIA',
      method: 'windows-uia-selection',
    })
    expect(electronMock.readText()).toBe('clipboard before capture')

    await vi.advanceTimersByTimeAsync(1_000)
    const sendKeysCalls = childProcessMock.execFile.mock.calls.filter(([, args]) =>
      isSendKeysCommand(args),
    )
    expect(sendKeysCalls).toHaveLength(0)
  })

  it('keeps the concurrent clipboard fallback active when UIA finds no selection', async () => {
    childProcessMock.execFile.mockImplementation(
      (_file: string, args: unknown[], _options: unknown, callback: ExecFileCallback) => {
        if (isUiaCommand(args)) {
          setTimeout(() => callback(new Error('no UIA selection')), 40)
          return
        }

        if (isSendKeysCommand(args)) {
          electronMock.setText('selected by clipboard')
        }
        callback(null, { stdout: '', stderr: '' })
      },
    )

    const { readSelectedText } = await import('../../src/main/modules/selection')
    const capture = readSelectedText()
    await vi.advanceTimersByTimeAsync(220)

    await expect(capture).resolves.toEqual({
      ok: true,
      text: 'selected by clipboard',
      method: 'windows-clipboard-fallback',
    })
    expect(electronMock.readText()).toBe('clipboard before capture')
    expect(
      childProcessMock.execFile.mock.calls.filter(([, args]) => isSendKeysCommand(args)),
    ).toHaveLength(1)
  })

  it('aborts an in-flight clipboard copy command when UIA succeeds', async () => {
    let copySignal: AbortSignal | undefined
    childProcessMock.execFile.mockImplementation(
      (
        _file: string,
        args: unknown[],
        options: { signal?: AbortSignal },
        callback: ExecFileCallback,
      ) => {
        if (isUiaCommand(args)) {
          setTimeout(() => callback(null, { stdout: 'selected by UIA', stderr: '' }), 200)
          return
        }

        copySignal = options.signal
        options.signal?.addEventListener(
          'abort',
          () => callback(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          { once: true },
        )
      },
    )

    const { readSelectedText } = await import('../../src/main/modules/selection')
    const capture = readSelectedText()
    await vi.advanceTimersByTimeAsync(200)

    await expect(capture).resolves.toEqual({
      ok: true,
      text: 'selected by UIA',
      method: 'windows-uia-selection',
    })
    expect(copySignal?.aborted).toBe(true)
    expect(electronMock.readText()).toBe('clipboard before capture')
  })
})
