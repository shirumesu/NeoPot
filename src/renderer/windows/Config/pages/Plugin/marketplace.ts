import marketplaceIndex from '../../../../../../marketplace-plugins.json'
import { pluginApi } from '@/renderer/lib/electron/adapter'
import { logger } from '@/renderer/lib/logger'

const MARKETPLACE_INDEX_URL =
  'https://raw.githubusercontent.com/shirumesu/NeoPot/master/marketplace-plugins.json'
const MARKETPLACE_FETCH_TIMEOUT_MS = 8000

export interface MarketplacePlugin {
  id: string
  type: string
  name: string
  display: string
  version: string
  author: string
  description: string
  repo: string
  download: string
  dev?: string
}

export interface PluginUpdate extends MarketplacePlugin {
  installedVersion: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMarketplacePlugin(value: unknown): value is MarketplacePlugin {
  if (!isRecord(value)) {
    return false
  }

  const requiredFields = [
    'id',
    'type',
    'name',
    'display',
    'version',
    'author',
    'description',
    'repo',
    'download',
  ]

  return (
    requiredFields.every((key) => typeof value[key] === 'string') &&
    (value.dev === undefined || typeof value.dev === 'string')
  )
}

function parseMarketplacePlugins(value: unknown): MarketplacePlugin[] {
  if (!Array.isArray(value) || !value.every(isMarketplacePlugin)) {
    throw new Error('Marketplace index must be an array of complete plugin entries.')
  }

  return value.map((plugin) => ({ ...plugin }))
}

function localMarketplacePlugins(): MarketplacePlugin[] {
  return parseMarketplacePlugins(marketplaceIndex)
}

async function loadRemoteMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => {
    controller.abort()
  }, MARKETPLACE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(MARKETPLACE_INDEX_URL, {
      cache: 'no-cache',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Marketplace index request failed with HTTP ${response.status}.`)
    }

    return parseMarketplacePlugins(await response.json())
  } finally {
    window.clearTimeout(timeout)
  }
}

export function compareVersion(left: string, right: string) {
  const leftParts = String(left ?? '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = String(right ?? '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

export function findPluginUpdates(installedPlugins: any[], marketplaceIndex: MarketplacePlugin[]) {
  const installedById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]))

  return marketplaceIndex
    .filter((remote) => {
      const installed = installedById.get(remote.id)
      return installed && compareVersion(remote.version, installed.version) > 0
    })
    .map((remote) => ({
      ...remote,
      installedVersion: installedById.get(remote.id)?.version ?? '',
    }))
}

export function marketplaceInstallSources(plugin: MarketplacePlugin): string[] {
  return [plugin.download, plugin.dev]
    .filter((source): source is string => typeof source === 'string' && source.trim().length > 0)
    .filter((source, index, sources) => sources.indexOf(source) === index)
}

export async function installMarketplacePluginSource(plugin: MarketplacePlugin): Promise<string> {
  const sources = marketplaceInstallSources(plugin)
  let lastError: unknown = null

  for (const source of sources) {
    try {
      await pluginApi.installFromUrl(source)
      return source
    } catch (error) {
      lastError = error
      logger.warn('Marketplace plugin source install failed; trying next source if available.', {
        id: plugin.id,
        source,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw lastError ?? new Error('Marketplace plugin has no installable source.')
}

export async function loadMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  try {
    return await loadRemoteMarketplacePlugins()
  } catch (error) {
    logger.warn('Remote marketplace index unavailable; falling back to bundled index.', {
      url: MARKETPLACE_INDEX_URL,
      reason: error instanceof Error ? error.message : String(error),
    })
    return localMarketplacePlugins()
  }
}

export async function checkPluginUpdates(installedPlugins: any[]) {
  const marketplacePlugins = await loadMarketplacePlugins()
  const marketplaceById = new Map(marketplacePlugins.map((plugin) => [plugin.id, plugin]))
  const updates: PluginUpdate[] = []

  for (const installed of installedPlugins) {
    const marketplacePlugin = marketplaceById.get(installed.id)
    const sources: string[] = []
    const addSource = (source: string | undefined) => {
      if (source && !sources.includes(source)) {
        sources.push(source)
      }
    }

    addSource(installed.installSource)
    for (const source of marketplacePlugin ? marketplaceInstallSources(marketplacePlugin) : []) {
      addSource(source)
    }

    if (sources.length === 0 || !pluginApi?.inspectSource) {
      continue
    }

    let highestVersion = installed.version
    let highestManifest: any = null
    let highestSource = ''

    for (const source of sources) {
      try {
        const sourceManifest = await pluginApi.inspectSource(source)
        if (
          sourceManifest.plugin_type !== installed.type ||
          sourceManifest.name !== installed.name
        ) {
          continue
        }

        const sourceVersion =
          typeof sourceManifest.version === 'string' ? sourceManifest.version : ''
        if (compareVersion(sourceVersion, highestVersion) > 0) {
          highestVersion = sourceVersion
          highestManifest = sourceManifest
          highestSource = source
        }
      } catch {
        // Failure of one source should not prevent examination of other sources
      }
    }

    if (highestManifest && highestSource) {
      updates.push({
        id: installed.id,
        type: installed.type,
        name: installed.name,
        display:
          typeof highestManifest.display === 'string'
            ? highestManifest.display
            : marketplacePlugin?.display || installed.display,
        version: highestVersion,
        author:
          typeof highestManifest.author === 'string'
            ? highestManifest.author
            : marketplacePlugin?.author || installed.author,
        description:
          typeof highestManifest.description === 'string'
            ? highestManifest.description
            : marketplacePlugin?.description || installed.description,
        repo: marketplacePlugin?.repo || '',
        download: highestSource,
        dev: marketplacePlugin?.dev,
        installedVersion: installed.version,
      })
    }
  }
  return updates
}
