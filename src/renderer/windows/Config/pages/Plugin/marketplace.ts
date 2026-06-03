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
    const sources: string[] = []

    // 收集所有可能的来源
    if (installed.installSource) {
      sources.push(installed.installSource)
    }
    if (marketplacePlugin?.download && marketplacePlugin.download !== installed.installSource) {
      sources.push(marketplacePlugin.download)
    }

    if (sources.length === 0 || !pluginApi?.inspectSource) {
      continue
    }

    let highestVersion = installed.version
    let highestManifest: any = null
    let highestSource = ''

    // 检查所有来源，找到最高版本
    for (const source of sources) {
      try {
        const sourceManifest = await pluginApi.inspectSource(source)
        if (sourceManifest.plugin_type !== installed.type || sourceManifest.name !== installed.name) {
          continue
        }

        const sourceVersion = typeof sourceManifest.version === 'string' ? sourceManifest.version : ''
        if (compareVersion(sourceVersion, highestVersion) > 0) {
          highestVersion = sourceVersion
          highestManifest = sourceManifest
          highestSource = source
        }
      } catch {
        // 某个来源失败不应阻止检查其他来源
      }
    }

    // 如果找到了更高的版本，添加到更新列表
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
        installedVersion: installed.version,
      })
    }
  }

  return updates
}
