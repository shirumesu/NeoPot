import { existsSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export const APP_USER_MODEL_ID = 'com.squirrel.neopot.neopot'

let resolvedAppIconPath: string | null = null

export function getAppIconPath(): string {
  if (resolvedAppIconPath) {
    return resolvedAppIconPath
  }

  const candidates = [
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
  ]
  resolvedAppIconPath = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
  return resolvedAppIconPath
}
