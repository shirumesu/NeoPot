import { beforeEach, describe, expect, it, vi } from 'vitest'

const windowMock = vi.hoisted(() => ({
  openWindow: vi.fn(),
  resizeTranslateWindowForText: vi.fn(),
  sendToWindow: vi.fn(),
}))

const selectionMock = vi.hoisted(() => ({
  readSelectedText: vi.fn(),
}))

vi.mock('../../src/main/modules/window', () => windowMock)
vi.mock('../../src/main/modules/selection', () => selectionMock)
vi.mock('../../src/main/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  windowMock.openWindow.mockResolvedValue({})
})

async function loadWorkflow() {
  return import('../../src/main/modules/workflow')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('Main translation workflow', () => {
  it('opens the translate window before resizing and delivering a text payload', async () => {
    const opened = deferred<object>()
    windowMock.openWindow.mockReturnValueOnce(opened.promise)
    const workflow = await loadWorkflow()

    const run = workflow.textTranslate('hello world')

    expect(workflow.getCurrentWorkflowText()).toBe('hello world')
    expect(windowMock.openWindow).toHaveBeenCalledWith('translate')
    expect(windowMock.resizeTranslateWindowForText).not.toHaveBeenCalled()
    expect(windowMock.sendToWindow).not.toHaveBeenCalled()

    opened.resolve({})
    await run

    expect(windowMock.resizeTranslateWindowForText).toHaveBeenCalledWith('hello world')
    expect(windowMock.sendToWindow).toHaveBeenCalledWith('translate', 'new_text', {
      kind: 'text',
      text: 'hello world',
    })
    expect(windowMock.resizeTranslateWindowForText.mock.invocationCallOrder[0]).toBeLessThan(
      windowMock.sendToWindow.mock.invocationCallOrder[0],
    )
  })

  it.each([
    ['inputTranslate', 'input'],
    ['imageTranslate', 'image'],
  ] as const)('delivers the %s workflow with an empty current text', async (method, kind) => {
    const workflow = await loadWorkflow()

    await workflow.textTranslate('stale text')
    vi.clearAllMocks()
    await workflow[method]()

    expect(workflow.getCurrentWorkflowText()).toBe('')
    expect(windowMock.openWindow).toHaveBeenCalledWith('translate')
    expect(windowMock.resizeTranslateWindowForText).toHaveBeenCalledWith('')
    expect(windowMock.sendToWindow).toHaveBeenCalledWith('translate', 'new_text', { kind })
  })

  it('serializes concurrent selection captures and allows a later request after completion', async () => {
    const capture = deferred<{
      ok: true
      text: string
      method: 'clipboard'
    }>()
    selectionMock.readSelectedText.mockReturnValueOnce(capture.promise).mockResolvedValueOnce({
      ok: true,
      text: 'second selection',
      method: 'clipboard',
    })
    const workflow = await loadWorkflow()

    const first = workflow.selectionTranslate()
    const duplicate = workflow.selectionTranslate()

    expect(duplicate).toBe(first)
    expect(selectionMock.readSelectedText).toHaveBeenCalledOnce()

    capture.resolve({ ok: true, text: 'first selection', method: 'clipboard' })
    await first

    expect(workflow.getCurrentWorkflowText()).toBe('first selection')
    expect(windowMock.sendToWindow).toHaveBeenLastCalledWith('translate', 'new_text', {
      kind: 'selection',
      capture: { ok: true, text: 'first selection', method: 'clipboard' },
    })

    await workflow.selectionTranslate()
    expect(selectionMock.readSelectedText).toHaveBeenCalledTimes(2)
    expect(workflow.getCurrentWorkflowText()).toBe('second selection')
  })

  it('forwards a failed selection capture without reusing stale workflow text', async () => {
    selectionMock.readSelectedText.mockResolvedValue({
      ok: false,
      reason: 'empty',
      method: 'clipboard',
    })
    const workflow = await loadWorkflow()

    await workflow.textTranslate('old text')
    vi.clearAllMocks()
    await workflow.selectionTranslate()

    expect(workflow.getCurrentWorkflowText()).toBe('')
    expect(windowMock.resizeTranslateWindowForText).toHaveBeenCalledWith('')
    expect(windowMock.sendToWindow).toHaveBeenCalledWith('translate', 'new_text', {
      kind: 'selection',
      capture: { ok: false, reason: 'empty', method: 'clipboard' },
    })
  })
})

describe('Main window and OCR workflows', () => {
  it.each([
    ['openConfig', 'config'],
    ['openTranslate', 'translate'],
    ['openUpdater', 'updater'],
  ] as const)('%s opens the expected window', async (method, label) => {
    const workflow = await loadWorkflow()

    await workflow[method]()

    expect(windowMock.openWindow).toHaveBeenCalledWith(label)
  })

  it('opens recognize with a fresh image event and clears previous text', async () => {
    const workflow = await loadWorkflow()
    await workflow.textTranslate('old text')
    vi.clearAllMocks()

    await workflow.recognizeWindow()

    expect(workflow.getCurrentWorkflowText()).toBe('')
    expect(windowMock.openWindow).toHaveBeenCalledWith('recognize')
    expect(windowMock.sendToWindow).toHaveBeenCalledWith('recognize', 'new_image', '')
  })

  it.each([
    ['ocrRecognize', 'recognize'],
    ['ocrTranslate', 'translate'],
  ] as const)('%s records and sends the screenshot action', async (method, action) => {
    const workflow = await loadWorkflow()

    await workflow[method]()

    expect(workflow.getCurrentScreenshotAction()).toBe(action)
    expect(windowMock.openWindow).toHaveBeenCalledWith('screenshot')
    expect(windowMock.sendToWindow).toHaveBeenCalledWith('screenshot', 'capture_screenshot', action)
  })
})
