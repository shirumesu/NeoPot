// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { NeoPotElectronApi } from '../../src/shared/types/electron-api'

const mocks = vi.hoisted(() => ({
  configGet: vi.fn(),
  configSet: vi.fn(),
  inspectMarketplace: vi.fn(),
  inspectSource: vi.fn(),
  installFromUrl: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@/renderer/lib/logger', () => ({
  logger: {
    warn: mocks.warn,
  },
}))

import {
  DEFAULT_MARKETPLACE_SOURCE,
  checkPluginUpdates,
  loadMarketplacePlugins,
} from '../../src/renderer/windows/Config/pages/Plugin/marketplace'
import type { InstalledPlugin } from '../../src/renderer/windows/Config/pages/Plugin/installedPlugins'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function marketplacePlugin(id: string, version = '1.0.0') {
  const [type, name] = id.split(':')
  return {
    id,
    type,
    name,
    display: name,
    version,
    author: 'NeoPot',
    description: `${name} plugin`,
    repo: `https://example.test/${name}`,
    download: `https://example.test/${name}.zip`,
    dev: `https://example.test/${name}-dev.zip`,
  }
}

function installedPlugin(id: string): InstalledPlugin {
  const remote = marketplacePlugin(id)
  return {
    ...remote,
    icon: '',
    enabled: true,
    installSource: `https://installed.example.test/${remote.name}.zip`,
    installSourceType: 'url',
    needs: [],
    hotkeys: [],
    options: [],
    homepage: '',
    language: {},
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.configGet.mockResolvedValue([])
  Object.defineProperty(window, 'neoPot', {
    configurable: true,
    value: {
      config: {
        get: mocks.configGet,
        set: mocks.configSet,
      },
      plugins: {
        inspectMarketplace: mocks.inspectMarketplace,
        inspectSource: mocks.inspectSource,
        installFromUrl: mocks.installFromUrl,
      },
    } as unknown as NeoPotElectronApi,
  })
})

describe('renderer plugin marketplace concurrency', () => {
  test('loads independent sources concurrently while preserving source precedence and status order', async () => {
    const sources = [DEFAULT_MARKETPLACE_SOURCE, 'slow-source', 'fast-source', 'broken-source']
    const pendingBySource = new Map(
      sources.map((source) => [source, deferred<ReturnType<typeof marketplacePlugin>[]>()]),
    )
    mocks.inspectMarketplace.mockImplementation(
      (source: string) => pendingBySource.get(source)?.promise,
    )

    const resultPromise = loadMarketplacePlugins(sources.slice(1))
    await vi.waitFor(() => expect(mocks.inspectMarketplace).toHaveBeenCalledTimes(4))

    pendingBySource.get('fast-source')?.resolve([marketplacePlugin('translate:shared', '2.0.0')])
    pendingBySource.get('broken-source')?.reject(new Error('offline'))
    pendingBySource
      .get(DEFAULT_MARKETPLACE_SOURCE)
      ?.resolve([marketplacePlugin('translate:shared', '2.0.0')])
    pendingBySource.get('slow-source')?.resolve([marketplacePlugin('tts:slow')])

    const result = await resultPromise
    expect(result.sources.map(({ source, ok }) => ({ source, ok }))).toEqual([
      { source: DEFAULT_MARKETPLACE_SOURCE, ok: true },
      { source: 'slow-source', ok: true },
      { source: 'fast-source', ok: true },
      { source: 'broken-source', ok: false },
    ])
    expect(result.plugins.find((plugin) => plugin.id === 'translate:shared')?.source).toBe(
      DEFAULT_MARKETPLACE_SOURCE,
    )
  })

  test('inspects update sources concurrently with a global limit of four requests', async () => {
    const installed = [
      installedPlugin('translate:first'),
      installedPlugin('recognize:second'),
      installedPlugin('tts:third'),
    ]
    mocks.inspectMarketplace.mockResolvedValue(
      installed.map((plugin) => marketplacePlugin(plugin.id)),
    )

    let active = 0
    let maximumActive = 0
    mocks.inspectSource.mockImplementation(async (source: string) => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1

      const plugin = installed.find((candidate) => source.includes(candidate.name))
      if (!plugin) {
        throw new Error('unexpected source')
      }
      return {
        plugin_type: plugin.type,
        name: plugin.name,
        display: plugin.display,
        version: source.includes('-dev.zip') ? '3.0.0' : '2.0.0',
        author: plugin.author,
        description: plugin.description,
      }
    })

    const updates = await checkPluginUpdates(installed)

    expect(maximumActive).toBe(4)
    expect(updates.map(({ id, version }) => ({ id, version }))).toEqual([
      { id: 'translate:first', version: '3.0.0' },
      { id: 'recognize:second', version: '3.0.0' },
      { id: 'tts:third', version: '3.0.0' },
    ])
  })
})
