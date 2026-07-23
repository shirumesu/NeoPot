import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('applies Linux window frame classes from the synchronous preload platform', async () => {
  vi.stubGlobal('window', {
    neoPot: {
      app: {
        platform: 'Linux',
      },
    },
  })

  const chrome = await import('../../src/renderer/components/windowChrome')

  expect(chrome.LINUX_WINDOW_FRAME_CLASS).toBe('rounded-[10px] border-1 border-default-100')
  expect(chrome.LINUX_CLOSE_WINDOW_CORNER_CLASS).toBe('rounded-tr-[10px]')
})
