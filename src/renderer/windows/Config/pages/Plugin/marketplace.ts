import marketplaceIndex from '../../../../../../marketplace-plugins.json'
import { pluginApi } from '@/renderer/lib/electron/adapter'

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
}

export interface PluginUpdate extends MarketplacePlugin {
  installedVersion: string
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

export async function loadMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  return (marketplaceIndex as MarketplacePlugin[]).map((plugin) => ({ ...plugin }))
}

export async function checkPluginUpdates(installedPlugins: any[]) {
  const marketplacePlugins = await loadMarketplacePlugins()
  const marketplaceById = new Map(marketplacePlugins.map((plugin) => [plugin.id, plugin]))
  const updates: PluginUpdate[] = []

  for (const installed of installedPlugins) {
    const marketplacePlugin = marketplaceById.get(installed.id)
    const source = installed.installSource || marketplacePlugin?.download
    if (!source || !pluginApi?.inspectSource) {
      continue
    }

    try {
      const sourceManifest = await pluginApi.inspectSource(source)
      if (sourceManifest.plugin_type !== installed.type || sourceManifest.name !== installed.name) {
        continue
      }

      const sourceVersion = typeof sourceManifest.version === 'string' ? sourceManifest.version : ''
      if (compareVersion(sourceVersion, installed.version) <= 0) {
        continue
      }

      updates.push({
        id: installed.id,
        type: installed.type,
        name: installed.name,
        display:
          typeof sourceManifest.display === 'string'
            ? sourceManifest.display
            : marketplacePlugin?.display || installed.display,
        version: sourceVersion,
        author:
          typeof sourceManifest.author === 'string'
            ? sourceManifest.author
            : marketplacePlugin?.author || installed.author,
        description:
          typeof sourceManifest.description === 'string'
            ? sourceManifest.description
            : marketplacePlugin?.description || installed.description,
        repo: marketplacePlugin?.repo || '',
        download: source,
        installedVersion: installed.version,
      })
    } catch {
      // One broken plugin source must not block checking the rest.
    }
  }

  return updates
}
