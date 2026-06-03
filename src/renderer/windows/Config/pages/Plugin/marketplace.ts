import marketplaceIndex from '../../../../../../marketplace-plugins.json'

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
  return findPluginUpdates(installedPlugins, await loadMarketplacePlugins())
}
