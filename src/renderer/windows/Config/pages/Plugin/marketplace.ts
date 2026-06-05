import { configApi, pluginApi } from '@/renderer/lib/electron/adapter'
import { logger } from '@/renderer/lib/logger'
import type { PluginMarketplaceEntry } from '@/shared/types/electron-api'
import { describeMarketplaceSourceError, type MarketplaceSourceErrorKind } from './marketplaceError'

export const DEFAULT_MARKETPLACE_SOURCE =
  'https://raw.githubusercontent.com/shirumesu/Neopot-releases/main/marketplace-plugins.json'
const MARKETPLACE_SOURCES_CONFIG_KEY = 'plugin_marketplace_sources'

export interface MarketplacePlugin extends PluginMarketplaceEntry {
  source: string
}

export interface MarketplaceSourceStatus {
  source: string
  isDefault: boolean
  ok: boolean
  count: number
  errorKind?: MarketplaceSourceErrorKind
  errorStatus?: number
  error?: string
}

export interface MarketplaceLoadResult {
  plugins: MarketplacePlugin[]
  sources: MarketplaceSourceStatus[]
}

export interface PluginUpdate extends MarketplacePlugin {
  installedVersion: string
}

function normalizeSourceList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const sources = value
    .filter((source): source is string => typeof source === 'string')
    .map((source) => source.trim())
    .filter((source) => source.length > 0 && source !== DEFAULT_MARKETPLACE_SOURCE)

  return sources.filter((source, index) => sources.indexOf(source) === index)
}

export async function loadCustomMarketplaceSources(): Promise<string[]> {
  return normalizeSourceList(await configApi.get(MARKETPLACE_SOURCES_CONFIG_KEY))
}

export async function saveCustomMarketplaceSources(sources: string[]): Promise<string[]> {
  const normalized = normalizeSourceList(sources)
  await configApi.set(MARKETPLACE_SOURCES_CONFIG_KEY, normalized)
  return normalized
}

function marketplaceSourceValues(customSources: string[]): string[] {
  return [DEFAULT_MARKETPLACE_SOURCE, ...normalizeSourceList(customSources)]
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

function mergeMarketplacePlugin(
  pluginsById: Map<string, MarketplacePlugin>,
  plugin: PluginMarketplaceEntry,
  source: string,
): void {
  const existing = pluginsById.get(plugin.id)
  if (!existing || compareVersion(plugin.version, existing.version) > 0) {
    pluginsById.set(plugin.id, {
      ...plugin,
      source,
    })
  }
}

export async function loadMarketplacePlugins(
  customSources?: string[],
): Promise<MarketplaceLoadResult> {
  const sources = marketplaceSourceValues(customSources ?? (await loadCustomMarketplaceSources()))
  const pluginsById = new Map<string, MarketplacePlugin>()
  const sourceStatuses: MarketplaceSourceStatus[] = []

  for (const [index, source] of sources.entries()) {
    try {
      const plugins = await pluginApi.inspectMarketplace(source)
      for (const plugin of plugins) {
        mergeMarketplacePlugin(pluginsById, plugin, source)
      }
      sourceStatuses.push({
        source,
        isDefault: index === 0,
        ok: true,
        count: plugins.length,
      })
    } catch (error) {
      const sourceError = describeMarketplaceSourceError(error)
      logger.warn('Plugin marketplace source unavailable.', {
        source,
        reason: sourceError.message,
      })
      sourceStatuses.push({
        source,
        isDefault: index === 0,
        ok: false,
        count: 0,
        errorKind: sourceError.kind,
        errorStatus: sourceError.status,
        error: sourceError.message,
      })
    }
  }

  return {
    plugins: [...pluginsById.values()].sort((left, right) =>
      left.display.localeCompare(right.display),
    ),
    sources: sourceStatuses,
  }
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

export async function checkPluginUpdates(installedPlugins: any[]) {
  const marketplaceResult = await loadMarketplacePlugins()
  const marketplacePlugins = marketplaceResult.plugins
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
        // Failure of one source should not prevent examination of other sources.
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
        source: marketplacePlugin?.source || highestSource,
      })
    }
  }
  return updates
}
