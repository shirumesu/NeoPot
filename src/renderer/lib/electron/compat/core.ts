import { electronInvoke } from '../command'
import { logger } from '@/renderer/lib/logger'

export function convertFileSrc(path: string) {
  return path
}

export async function invoke<T = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await electronInvoke<T>({ command, payload: args })
  } catch (error) {
    logger.error('Electron command failed.', error, {
      command,
    })
    throw error
  }
}
