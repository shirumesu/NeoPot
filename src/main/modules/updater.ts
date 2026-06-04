import { BrowserWindow, app, net, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type {
  UpdateCheckResult,
  UpdateDistribution,
  UpdateEvent,
  UpdateMode,
  UpdateProgress,
} from '../../shared/types/electron-api'
import { logger } from '../logger'
import { getConfig } from './config'
import { openUpdaterNotification, sendToWindow } from './window'

interface GithubRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  prerelease?: boolean
}

const githubApiBaseUrl = 'https://api.github.com/repos/shirumesu/NeoPot/releases'
const releasePageUrl = 'https://github.com/shirumesu/NeoPot/releases'

let lastCheckResult: UpdateCheckResult | null = null
let latestReleasePageUrl = releasePageUrl
let autoUpdaterListenersAttached = false

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Update check failed.'
}

function createResult(
  status: UpdateCheckResult['status'],
  distribution: UpdateDistribution,
  mode: UpdateMode,
  extra: Partial<UpdateCheckResult> = {},
): UpdateCheckResult {
  return {
    status,
    distribution,
    mode,
    currentVersion: app.getVersion(),
    ...extra,
  }
}

function publishEvent(event: UpdateEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('update:event', event)
    }
  }
}

function publishResultEvent(result: UpdateCheckResult): void {
  if (result.status === 'available') {
    publishEvent({ type: 'available', result })
  } else if (result.status === 'not-available') {
    publishEvent({ type: 'not-available', result })
  } else if (result.status === 'unsupported') {
    publishEvent({ type: 'unsupported', result })
  } else {
    publishEvent({ type: 'error', result, message: result.message ?? 'Update check failed.' })
  }
}

function getDistributionMode(): { distribution: UpdateDistribution; mode: UpdateMode } {
  if (!app.isPackaged) {
    return { distribution: 'unknown', mode: 'manual-download' }
  }

  if (process.platform === 'linux') {
    return process.env.APPIMAGE
      ? { distribution: 'appimage', mode: 'self-update' }
      : { distribution: 'deb-rpm', mode: 'manual-download' }
  }

  if (process.platform === 'win32') {
    const executableDir = path.dirname(process.execPath)
    const uninstallExe = path.join(executableDir, `Uninstall ${app.getName()}.exe`)
    return existsSync(uninstallExe)
      ? { distribution: 'installer', mode: 'self-update' }
      : { distribution: 'portable', mode: 'manual-download' }
  }

  return { distribution: 'unknown', mode: 'manual-download' }
}

function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function parseVersion(version: string): { parts: number[]; prerelease: string } | null {
  const normalized = stripVersionPrefix(version)
  const match = normalized.match(/^(\d+(?:\.\d+){0,2})(?:[-+.]?(.+))?$/)
  if (!match) {
    return null
  }

  const parts = match[1].split('.').map((part) => Number(part))
  while (parts.length < 3) {
    parts.push(0)
  }

  return {
    parts,
    prerelease: match[2] ?? '',
  }
}

export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)
  if (!parsedA || !parsedB) {
    return stripVersionPrefix(a).localeCompare(stripVersionPrefix(b))
  }

  for (let index = 0; index < 3; index += 1) {
    const diff = parsedA.parts[index] - parsedB.parts[index]
    if (diff !== 0) {
      return diff
    }
  }

  if (parsedA.prerelease === parsedB.prerelease) {
    return 0
  }
  if (!parsedA.prerelease) {
    return 1
  }
  if (!parsedB.prerelease) {
    return -1
  }

  return parsedA.prerelease.localeCompare(parsedB.prerelease)
}

function isPrereleaseVersion(version: string): boolean {
  return parseVersion(version)?.prerelease !== ''
}

function getReleaseVersion(release: GithubRelease): string | undefined {
  return release.tag_name ? stripVersionPrefix(release.tag_name) : undefined
}

async function fetchGithubRelease(): Promise<GithubRelease | null> {
  const currentVersion = app.getVersion()
  const allowPrerelease = isPrereleaseVersion(currentVersion)
  const endpoint = allowPrerelease ? githubApiBaseUrl : `${githubApiBaseUrl}/latest`
  const response = await net.fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub Releases returned HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as GithubRelease | GithubRelease[]
  if (!Array.isArray(payload)) {
    return payload
  }

  return (
    payload.find((release) => {
      const version = getReleaseVersion(release)
      return Boolean(version) && (allowPrerelease || release.prerelease !== true)
    }) ?? null
  )
}

async function checkGithubRelease(
  distribution: UpdateDistribution,
  mode: UpdateMode,
): Promise<UpdateCheckResult> {
  const release = await fetchGithubRelease()
  const releaseVersion = release ? getReleaseVersion(release) : undefined
  if (!release || !releaseVersion) {
    return createResult('unsupported', distribution, mode, {
      message: 'No release metadata is available.',
      releasePageUrl,
    })
  }

  const resultBase = {
    version: releaseVersion,
    releaseName: release.name,
    releaseNotes: release.body,
    releasePageUrl: release.html_url ?? releasePageUrl,
  }
  latestReleasePageUrl = resultBase.releasePageUrl

  if (compareVersions(releaseVersion, app.getVersion()) > 0) {
    return createResult('available', distribution, mode, resultBase)
  }

  return createResult('not-available', distribution, mode, resultBase)
}

function applyConfiguredFeed(): void {
  const feedUrl = getConfig('updater_feed_url')
  if (typeof feedUrl !== 'string' || feedUrl.trim() === '') {
    return
  }

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: feedUrl.trim(),
  })
}

function attachAutoUpdaterListeners(): void {
  if (autoUpdaterListenersAttached) {
    return
  }

  autoUpdaterListenersAttached = true

  autoUpdater.on('checking-for-update', () => {
    publishEvent({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    const mode = getDistributionMode()
    const result = createResult('available', mode.distribution, mode.mode, {
      version: info.version,
      releaseName: info.releaseName ?? undefined,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releasePageUrl: releasePageUrl,
    })
    lastCheckResult = result
    publishEvent({ type: 'available', result })
  })

  autoUpdater.on('update-not-available', (info) => {
    const mode = getDistributionMode()
    const result = createResult('not-available', mode.distribution, mode.mode, {
      version: info.version,
      releaseName: info.releaseName ?? undefined,
      releasePageUrl: releasePageUrl,
    })
    lastCheckResult = result
    publishEvent({ type: 'not-available', result })
  })

  autoUpdater.on('download-progress', (progress) => {
    const eventProgress: UpdateProgress = {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    }
    publishEvent({ type: 'download-progress', progress: eventProgress })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const mode = getDistributionMode()
    const result = createResult('available', mode.distribution, mode.mode, {
      version: info.version,
      releaseName: info.releaseName ?? undefined,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releasePageUrl: releasePageUrl,
    })
    lastCheckResult = result
    publishEvent({ type: 'downloaded', result })
  })

  autoUpdater.on('error', (error) => {
    const message = safeErrorMessage(error)
    logger.error('Auto updater failed.', error)
    publishEvent({ type: 'error', message })
  })
}

async function checkSelfUpdate(
  distribution: UpdateDistribution,
  mode: UpdateMode,
): Promise<UpdateCheckResult> {
  attachAutoUpdaterListeners()
  applyConfiguredFeed()
  const updateCheck = await autoUpdater.checkForUpdates()
  const updateInfo = updateCheck?.updateInfo

  if (!updateInfo) {
    return createResult('unsupported', distribution, mode, {
      message: 'No update metadata is available.',
      releasePageUrl,
    })
  }

  const result = createResult(
    compareVersions(updateInfo.version, app.getVersion()) > 0 ? 'available' : 'not-available',
    distribution,
    mode,
    {
      version: updateInfo.version,
      releaseName: updateInfo.releaseName ?? undefined,
      releaseNotes:
        typeof updateInfo.releaseNotes === 'string' ? updateInfo.releaseNotes : undefined,
      releasePageUrl,
    },
  )
  return result
}

export async function check(): Promise<UpdateCheckResult> {
  publishEvent({ type: 'checking' })
  const { distribution, mode } = getDistributionMode()

  try {
    const result =
      mode === 'self-update'
        ? await checkSelfUpdate(distribution, mode)
        : await checkGithubRelease(distribution, mode)

    lastCheckResult = result
    publishResultEvent(result)
    return result
  } catch (error) {
    const message = safeErrorMessage(error)
    logger.error('Update check failed.', error)
    const result = createResult('error', distribution, mode, {
      message,
      releasePageUrl,
    })
    lastCheckResult = result
    publishResultEvent(result)
    return result
  }
}

export async function download(): Promise<void> {
  const mode = getDistributionMode()
  if (mode.mode !== 'self-update') {
    await openReleasePage()
    return
  }

  await autoUpdater.downloadUpdate()
}

export function install(): void {
  const mode = getDistributionMode()
  if (mode.mode !== 'self-update') {
    void openReleasePage()
    return
  }

  publishEvent({ type: 'installing' })
  autoUpdater.quitAndInstall()
}

export async function openReleasePage(): Promise<void> {
  const target = lastCheckResult?.releasePageUrl ?? latestReleasePageUrl
  await shell.openExternal(target)
}

async function showStartupNotification(result: UpdateCheckResult): Promise<void> {
  if (result.status !== 'available') {
    return
  }

  await openUpdaterNotification()
  sendToWindow('updater', 'startup_update_available', result)
  publishEvent({ type: 'available', result })
}

export async function runStartupUpdateCheck(): Promise<void> {
  try {
    const result = await check()
    if (result.status === 'available') {
      await showStartupNotification(result)
    }
  } catch (error) {
    logger.error('Startup update check failed.', error)
  }
}
