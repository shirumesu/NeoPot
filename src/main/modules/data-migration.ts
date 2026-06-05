import { app } from 'electron'
import { copyFile, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface LegacyDataDetection {
  configPath: string
  historyPath: string
  pluginsPath: string
  hasConfig: boolean
  hasHistory: boolean
  hasPlugins: boolean
}

export interface DataMigrationResult {
  status: 'migrated' | 'already-migrated' | 'no-legacy-data' | 'failed'
  backupPath?: string
  error?: string
}

const migrationFileName = 'migration.json'

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function electronUserDataPath(): string {
  return app.getPath('userData')
}

function legacyBasePath(): string {
  return path.join(app.getPath('appData'), 'com.pot-app.desktop')
}

export async function detectLegacyData(): Promise<LegacyDataDetection> {
  const legacyBase = legacyBasePath()
  const configPath = path.join(legacyBase, 'config.json')
  const historyPath = path.join(legacyBase, 'history.db')
  const pluginsPath = path.join(legacyBase, 'plugins')

  return {
    configPath,
    historyPath,
    pluginsPath,
    hasConfig: await exists(configPath),
    hasHistory: await exists(historyPath),
    hasPlugins: await exists(pluginsPath),
  }
}

export async function getMigrationStatus(): Promise<DataMigrationResult> {
  const statusPath = path.join(electronUserDataPath(), migrationFileName)
  if (!(await exists(statusPath))) {
    return { status: 'no-legacy-data' }
  }

  return JSON.parse(await readFile(statusPath, 'utf8')) as DataMigrationResult
}

export async function createBackup(detection: LegacyDataDetection): Promise<string> {
  const backupPath = path.join(electronUserDataPath(), 'legacy-backup')
  await mkdir(backupPath, { recursive: true })

  if (detection.hasConfig) {
    await copyFile(detection.configPath, path.join(backupPath, 'config.json'))
  }
  if (detection.hasHistory) {
    await copyFile(detection.historyPath, path.join(backupPath, 'history.db'))
  }
  if (detection.hasPlugins) {
    await cp(detection.pluginsPath, path.join(backupPath, 'plugins'), {
      recursive: true,
      force: true,
    })
  }

  return backupPath
}

export async function runDataMigration(): Promise<DataMigrationResult> {
  const existingStatus = await getMigrationStatus()
  if (existingStatus.status === 'migrated' || existingStatus.status === 'already-migrated') {
    return {
      ...existingStatus,
      status: 'already-migrated',
    }
  }

  const detection = await detectLegacyData()
  if (!detection.hasConfig && !detection.hasHistory && !detection.hasPlugins) {
    return { status: 'no-legacy-data' }
  }

  try {
    const backupPath = await createBackup(detection)
    const result: DataMigrationResult = {
      status: 'migrated',
      backupPath,
    }
    await writeFile(
      path.join(electronUserDataPath(), migrationFileName),
      JSON.stringify(result, null, 2),
    )
    return result
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
