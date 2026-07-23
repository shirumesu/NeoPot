import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
  unregister: vi.fn(),
}))

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getPath: electronMock.getPath },
  globalShortcut: { unregister: electronMock.unregister },
}))
vi.mock('../../src/main/modules/config', () => ({
  getConfig: vi.fn(() => undefined),
  setConfig: vi.fn(),
}))
vi.mock('../../src/main/logger', () => ({ logger: loggerMock }))

let userDataRoot = ''

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  userDataRoot = await mkdtemp(path.join(tmpdir(), 'neopot-plugin-list-'))
  electronMock.getPath.mockReturnValue(userDataRoot)
})

afterEach(async () => {
  await rm(userDataRoot, { recursive: true, force: true })
})

describe('installed plugin listing', () => {
  it('returns valid plugins when a neighboring manifest contains invalid JSON', async () => {
    const typeRoot = path.join(userDataRoot, 'plugins', 'translate')
    const validRoot = path.join(typeRoot, 'valid')
    const brokenRoot = path.join(typeRoot, 'broken')
    await mkdir(validRoot, { recursive: true })
    await mkdir(brokenRoot, { recursive: true })
    await writeFile(
      path.join(validRoot, 'info.json'),
      JSON.stringify({
        plugin_type: 'translate',
        name: 'valid',
        display: 'Valid plugin',
        version: '1.0.0',
      }),
      'utf8',
    )
    await writeFile(path.join(brokenRoot, 'info.json'), '{"name":', 'utf8')

    const { listInstalledPlugins } = await import('../../src/main/plugins/installer')
    const plugins = await listInstalledPlugins('translate')

    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toMatchObject({
      id: 'translate:valid',
      type: 'translate',
      name: 'valid',
      display: 'Valid plugin',
    })
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Ignoring plugin with an invalid manifest.',
      expect.objectContaining({ type: 'translate', name: 'broken' }),
    )
  })
})
