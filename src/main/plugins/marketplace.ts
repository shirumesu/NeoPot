import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PluginMarketplaceEntry {
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

const MARKETPLACE_FETCH_TIMEOUT_MS = 8000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMarketplaceEntry(value: unknown): value is PluginMarketplaceEntry {
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

function parseMarketplaceEntries(text: string): PluginMarketplaceEntry[] {
  const value = JSON.parse(text) as unknown
  if (!Array.isArray(value) || !value.every(isMarketplaceEntry)) {
    throw new Error('Marketplace index must be an array of complete plugin entries.')
  }

  return value.map((plugin) => ({ ...plugin }))
}

async function readRemoteMarketplace(candidates: string[]): Promise<PluginMarketplaceEntry[]> {
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      return await fetchMarketplace(candidate)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Marketplace source did not resolve to a readable index.')
}

async function fetchMarketplace(source: string): Promise<PluginMarketplaceEntry[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, MARKETPLACE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(source, {
      cache: 'no-cache',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Marketplace index request failed with HTTP ${response.status}.`)
    }

    return parseMarketplaceEntries(await response.text())
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeGithubRepoName(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo
}

function githubUrlFromSource(source: string): URL | null {
  const trimmed = source.trim()
  const sshCloneMatch = trimmed.match(/^git@github\.com:([^/\s]+)\/([^\s]+)$/i)
  if (sshCloneMatch) {
    return new URL(`https://github.com/${sshCloneMatch[1]}/${sshCloneMatch[2]}`)
  }

  const protocolLessMatch = trimmed.match(/^github\.com\/(.+)$/i)
  if (protocolLessMatch) {
    return new URL(`https://github.com/${protocolLessMatch[1]}`)
  }

  const normalized = trimmed
    .replace(/^git\+https:\/\//i, 'https://')
    .replace(/^git\+ssh:\/\//i, 'ssh://')

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    return host === 'github.com' ? url : null
  } catch {
    return null
  }
}

function githubMarketplaceCandidates(source: string): string[] | null {
  const url = githubUrlFromSource(source)
  if (!url) {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'github.com') {
    return null
  }
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length < 2) {
    return null
  }

  const owner = parts[0]
  const repo = normalizeGithubRepoName(parts[1])

  if (parts[2] === 'blob' && parts.length >= 5) {
    const branch = parts[3]
    const filePath = parts.slice(4).join('/')
    return [`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`]
  }

  if (parts[2] === 'tree' && parts.length >= 4) {
    const branch = parts[3]
    const directoryPath = parts.slice(4).join('/')
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${directoryPath ? `${directoryPath}/` : ''}marketplace-plugins.json`,
    ]
  }

  if (parts.length === 2) {
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/marketplace-plugins.json`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/marketplace-plugins.json`,
    ]
  }

  return null
}

function remoteMarketplaceCandidates(source: string): string[] {
  const githubCandidates = githubMarketplaceCandidates(source)
  if (githubCandidates) {
    return githubCandidates
  }

  return /^https?:\/\//i.test(source) ? [source] : []
}

function resolveLocalMarketplacePath(source: string): string {
  if (/^file:\/\//i.test(source)) {
    return fileURLToPath(source)
  }

  return path.resolve(source)
}

async function readLocalMarketplace(source: string): Promise<PluginMarketplaceEntry[]> {
  const sourcePath = resolveLocalMarketplacePath(source)
  const stats = await stat(sourcePath)
  const marketplacePath = stats.isDirectory()
    ? path.join(sourcePath, 'marketplace-plugins.json')
    : sourcePath

  if (path.extname(marketplacePath).toLowerCase() !== '.json') {
    throw new Error('Local marketplace sources must be JSON files.')
  }

  return parseMarketplaceEntries(await readFile(marketplacePath, 'utf8'))
}

export async function readPluginMarketplaceFromSource(
  source: string,
): Promise<PluginMarketplaceEntry[]> {
  const trimmedSource = source.trim()
  const remoteCandidates = remoteMarketplaceCandidates(trimmedSource)

  return remoteCandidates.length > 0
    ? readRemoteMarketplace(remoteCandidates)
    : readLocalMarketplace(trimmedSource)
}
