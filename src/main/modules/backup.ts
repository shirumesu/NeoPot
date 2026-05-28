import { app } from 'electron'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

export type BackupResult =
  | { status: 'ok'; path: string }
  | { status: 'failed'; code: 'BACKUP_FAILED' | 'RESTORE_FAILED'; message: string }

function userDataPath(): string {
  return app.getPath('userData')
}

export async function createBackup(
  target = path.join(userDataPath(), 'backup'),
): Promise<BackupResult> {
  try {
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })
    await cp(path.join(userDataPath(), 'config.json'), path.join(target, 'config.json'), {
      force: true,
    }).catch(() => undefined)
    await cp(path.join(userDataPath(), 'history.db'), path.join(target, 'history.db'), {
      force: true,
    }).catch(() => undefined)
    await cp(path.join(userDataPath(), 'plugins'), path.join(target, 'plugins'), {
      recursive: true,
      force: true,
    }).catch(() => undefined)

    return {
      status: 'ok',
      path: target,
    }
  } catch (error) {
    return {
      status: 'failed',
      code: 'BACKUP_FAILED',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function restoreBackup(source: string): Promise<BackupResult> {
  const restorePoint = `${userDataPath()}.restore-point`
  try {
    await rm(restorePoint, { recursive: true, force: true })
    await cp(userDataPath(), restorePoint, { recursive: true, force: true }).catch(() => undefined)
    await cp(source, userDataPath(), { recursive: true, force: true })
    return {
      status: 'ok',
      path: source,
    }
  } catch (error) {
    await cp(restorePoint, userDataPath(), { recursive: true, force: true }).catch(() => undefined)
    return {
      status: 'failed',
      code: 'RESTORE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
