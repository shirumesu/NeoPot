export const mockMarketplaceIndex = [
  {
    id: 'translate:plugin-openai-translator',
    type: 'translate',
    name: 'plugin-openai-translator',
    display: 'OpenAI Translator',
    version: '1.1.0',
    author: 'NeoPot Community',
    description: 'Mock marketplace entry for a translation plugin.',
    repo: 'mock://plugins/openai-translator',
    download: 'mock://plugins/openai-translator/releases/latest/plugin.npot',
  },
  {
    id: 'recognize:plugin-screen-ocr',
    type: 'recognize',
    name: 'plugin-screen-ocr',
    display: 'Screen OCR',
    version: '0.5.0',
    author: 'NeoPot Community',
    description: 'Mock marketplace entry for an OCR plugin.',
    repo: 'mock://plugins/screen-ocr',
    download: 'mock://plugins/screen-ocr/releases/latest/plugin.npot',
  },
]

function compareVersion(left, right) {
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

export function findPluginUpdates(installedPlugins, marketplaceIndex) {
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

export async function loadMarketplacePlugins() {
  return mockMarketplaceIndex.map((plugin) => ({ ...plugin }))
}

export async function checkPluginUpdates(installedPlugins) {
  return findPluginUpdates(installedPlugins, await loadMarketplacePlugins())
}
