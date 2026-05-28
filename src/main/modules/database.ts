import { app } from 'electron'
import Database from 'better-sqlite3'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

type DatabaseConnection = ReturnType<typeof Database>

let database: DatabaseConnection | null = null

function databasePath(): string {
  return path.join(app.getPath('userData'), 'history.db')
}

export function getDatabase(): DatabaseConnection {
  if (!database) {
    database = new Database(databasePath())
  }

  return database
}

export function runMigrations(): void {
  try {
    const db = getDatabase()
    db.exec(`
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL DEFAULT '',
                result TEXT NOT NULL DEFAULT '',
                source TEXT,
                target TEXT,
                service TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Could not locate the bindings file')
        ? 'better-sqlite3 native binding is missing.'
        : error instanceof Error
          ? error.message.split('\n')[0]
          : String(error)
    console.warn(`History database is unavailable; continuing without migration. ${message}`)
  }
}

export async function importLegacyHistory(
  sourcePath: string,
): Promise<{ status: 'imported' | 'rollback' }> {
  const targetPath = databasePath()
  const rollbackPath = `${targetPath}.rollback`

  try {
    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(targetPath, rollbackPath).catch(() => undefined)
    await copyFile(sourcePath, targetPath)
    database?.close()
    database = null
    runMigrations()
    return { status: 'imported' }
  } catch {
    await copyFile(rollbackPath, targetPath).catch(() => undefined)
    return { status: 'rollback' }
  }
}
