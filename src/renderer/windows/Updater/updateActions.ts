import type { UpdateCheckResult } from '@/shared/types/electron-api'

export type UpdatePrimaryAction = 'check' | 'open-release-page' | 'install' | 'download' | 'none'

export function getUpdatePrimaryAction(
  result: UpdateCheckResult | null,
  isReadyToRestart: boolean,
): UpdatePrimaryAction {
  if (!result || result.status === 'error') {
    return 'check'
  }

  if (result.status === 'unsupported') {
    return 'open-release-page'
  }

  if (result.status !== 'available') {
    return 'none'
  }

  if (result.mode === 'manual-download') {
    return 'open-release-page'
  }

  return isReadyToRestart ? 'install' : 'download'
}
