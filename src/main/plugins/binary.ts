import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { installedPluginDir } from './installer'

const execFileAsync = promisify(execFile)

export interface RunPluginBinaryPayload {
  pluginType: string
  pluginName: string
  cmdName: string
  args?: unknown
}

export interface RunPluginBinaryResult {
  stdout: string
  stderr: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertInside(parent: string, child: string): void {
  const parentPath = path.resolve(parent)
  const childPath = path.resolve(child)
  const comparisonParent = process.platform === 'win32' ? parentPath.toLowerCase() : parentPath
  const comparisonChild = process.platform === 'win32' ? childPath.toLowerCase() : childPath
  if (!comparisonChild.startsWith(comparisonParent + path.sep)) {
    throw new Error('Plugin binary path must stay inside the plugin directory.')
  }
}

function normalizeArg(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function normalizeArgs(args: unknown): string[] {
  if (args === undefined || args === null) {
    return []
  }

  if (Array.isArray(args)) {
    return args.map(normalizeArg)
  }

  if (isRecord(args) && Array.isArray(args.argv)) {
    return args.argv.map(normalizeArg)
  }

  return [normalizeArg(args)]
}

async function existingPath(filePath: string): Promise<string | null> {
  return access(filePath)
    .then(() => filePath)
    .catch(() => null)
}

async function resolveBinaryPath(pluginDir: string, cmdName: string): Promise<string> {
  if (!cmdName.trim() || path.isAbsolute(cmdName)) {
    throw new Error('Plugin binary command must be a relative path.')
  }

  const normalizedCommand = cmdName.replaceAll('\\', '/')
  if (normalizedCommand.split('/').some((part) => part === '..')) {
    throw new Error('Plugin binary command cannot contain parent path segments.')
  }

  const candidate = path.resolve(pluginDir, normalizedCommand)
  assertInside(pluginDir, candidate)

  const existing = await existingPath(candidate)
  if (existing) {
    return existing
  }

  if (process.platform === 'win32' && path.extname(candidate) === '') {
    const exeCandidate = `${candidate}.exe`
    assertInside(pluginDir, exeCandidate)
    const existingExe = await existingPath(exeCandidate)
    if (existingExe) {
      return existingExe
    }
  }

  throw new Error(`Plugin binary was not found: ${cmdName}`)
}

export async function runPluginBinary(
  payload: RunPluginBinaryPayload,
): Promise<RunPluginBinaryResult> {
  const pluginDir = installedPluginDir(payload.pluginType, payload.pluginName)
  const binaryPath = await resolveBinaryPath(pluginDir, payload.cmdName)
  const { stdout, stderr } = await execFileAsync(binaryPath, normalizeArgs(payload.args), {
    cwd: pluginDir,
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  })

  return { stdout, stderr }
}
