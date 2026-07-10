import AdmZip from 'adm-zip'
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PLUGIN_METADATA_FILE = '.neopot-plugin.json'

const PLUGIN_ID_PATTERN = /^[a-z0-9_-]+$/

export class PluginInstallError extends Error {
  constructor(
    readonly code: 'PLUGIN_INVALID_PACKAGE' | 'PLUGIN_ZIP_SLIP',
    message: string,
  ) {
    super(message)
    this.name = 'PluginInstallError'
  }
}

export interface PluginInstallResult {
  status: 'installed'
  type: string
  name: string
}

export interface PluginInstallSource {
  installSource: string
  installSourceType: 'local' | 'url'
}

interface CreatePluginInstallerCoreOptions {
  pluginRoot: string
  now?: () => number
}

export interface PluginInstallerCore {
  installFromDirectory(
    sourceDirectory: string,
    source: PluginInstallSource,
  ): Promise<PluginInstallResult>
  installFromZip(zipFile: string, source: PluginInstallSource): Promise<PluginInstallResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isValidPluginIdentityPart(value: string): boolean {
  return PLUGIN_ID_PATTERN.test(value)
}

export function assertValidPluginIdentity(type: string, name: string) {
  if (!isValidPluginIdentityPart(type) || !isValidPluginIdentityPart(name)) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin type and name may contain only lowercase letters, numbers, underscores, and hyphens.',
    )
  }

  return { type, name }
}

export function parsePluginManifest(text: string): Record<string, unknown> {
  try {
    const manifest: unknown = JSON.parse(text)
    if (!isRecord(manifest)) {
      throw new Error('Plugin manifest must be a JSON object.')
    }
    return manifest
  } catch (error) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `Plugin manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function manifestIdentity(manifest: Record<string, unknown>) {
  const pluginType = manifest.plugin_type
  const pluginName = manifest.name
  if (typeof pluginType !== 'string' || typeof pluginName !== 'string') {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin manifest is missing plugin_type or name.',
    )
  }

  const identity = assertValidPluginIdentity(pluginType, pluginName)
  return { pluginType: identity.type, pluginName: identity.name }
}

function assertInside(parent: string, child: string): void {
  const parentPath = path.resolve(parent)
  const childPath = path.resolve(child)
  const comparisonParent = process.platform === 'win32' ? parentPath.toLowerCase() : parentPath
  const comparisonChild = process.platform === 'win32' ? childPath.toLowerCase() : childPath
  if (
    comparisonChild !== comparisonParent &&
    !comparisonChild.startsWith(comparisonParent + path.sep)
  ) {
    throw new PluginInstallError(
      'PLUGIN_ZIP_SLIP',
      'Plugin package contains an unsafe extraction path.',
    )
  }
}

export function resolveInstalledPluginDir(root: string, type: string, name: string): string {
  const identity = assertValidPluginIdentity(type, name)
  const resolvedRoot = path.resolve(root)
  const pluginDirectory = path.resolve(resolvedRoot, identity.type, identity.name)
  assertInside(resolvedRoot, pluginDirectory)
  return pluginDirectory
}

async function isFile(file: string): Promise<boolean> {
  return stat(file)
    .then((fileStat) => fileStat.isFile())
    .catch(() => false)
}

async function writeInstallMetadata(
  targetDirectory: string,
  source: PluginInstallSource,
  installedAt: number,
): Promise<void> {
  await writeFile(
    path.join(targetDirectory, PLUGIN_METADATA_FILE),
    JSON.stringify(
      {
        installSource: source.installSource,
        installSourceType: source.installSourceType,
        installedAt,
      },
      null,
      2,
    ),
    'utf8',
  )
}

export function createPluginInstallerCore({
  pluginRoot,
  now = Date.now,
}: CreatePluginInstallerCoreOptions): PluginInstallerCore {
  const root = path.resolve(pluginRoot)

  async function replacePlugin(
    pluginType: string,
    pluginName: string,
    populate: (temporaryDirectory: string) => Promise<void>,
    source: PluginInstallSource,
  ): Promise<PluginInstallResult> {
    const targetDirectory = resolveInstalledPluginDir(root, pluginType, pluginName)
    const temporaryDirectory = `${targetDirectory}.tmp`
    assertInside(root, temporaryDirectory)

    await rm(temporaryDirectory, { recursive: true, force: true })
    await mkdir(temporaryDirectory, { recursive: true })

    try {
      await populate(temporaryDirectory)
      await writeInstallMetadata(temporaryDirectory, source, now())
      await rm(targetDirectory, { recursive: true, force: true })
      await mkdir(path.dirname(targetDirectory), { recursive: true })
      await rename(temporaryDirectory, targetDirectory)
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true })
      throw error
    }

    return {
      status: 'installed',
      type: pluginType,
      name: pluginName,
    }
  }

  async function installFromDirectory(
    sourceDirectory: string,
    source: PluginInstallSource,
  ): Promise<PluginInstallResult> {
    const manifestFile = path.join(sourceDirectory, 'info.json')
    const manifestText = await readFile(manifestFile, 'utf8').catch(() => null)
    if (!manifestText) {
      throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Directory must contain info.json.')
    }
    if (!(await isFile(path.join(sourceDirectory, 'main.js')))) {
      throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Directory must contain main.js.')
    }

    const { pluginType, pluginName } = manifestIdentity(parsePluginManifest(manifestText))
    return replacePlugin(
      pluginType,
      pluginName,
      (temporaryDirectory) => cp(sourceDirectory, temporaryDirectory, { recursive: true }),
      source,
    )
  }

  async function installFromZip(
    zipFile: string,
    source: PluginInstallSource,
  ): Promise<PluginInstallResult> {
    const zip = new AdmZip(zipFile)
    const entries = zip.getEntries()
    const manifestEntry = entries.find((entry) => entry.entryName === 'info.json')
    const mainJsEntry = entries.find((entry) => entry.entryName === 'main.js')
    if (!manifestEntry) {
      throw new PluginInstallError(
        'PLUGIN_INVALID_PACKAGE',
        'Plugin package must contain info.json.',
      )
    }
    if (!mainJsEntry || mainJsEntry.isDirectory) {
      throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin package must contain main.js.')
    }

    const { pluginType, pluginName } = manifestIdentity(
      parsePluginManifest(manifestEntry.getData().toString('utf8')),
    )

    return replacePlugin(
      pluginType,
      pluginName,
      async (temporaryDirectory) => {
        for (const entry of entries) {
          const targetPath = path.resolve(temporaryDirectory, entry.entryName)
          assertInside(temporaryDirectory, targetPath)
          if (entry.isDirectory) {
            await mkdir(targetPath, { recursive: true })
            continue
          }

          await mkdir(path.dirname(targetPath), { recursive: true })
          await writeFile(targetPath, entry.getData())
        }
      },
      source,
    )
  }

  return { installFromDirectory, installFromZip }
}
