import type { TFunction } from 'i18next'
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

  if (result.status === 'not-available') {
    return 'check'
  }

  if (result.status !== 'available') {
    return 'none'
  }

  if (result.mode === 'manual-download') {
    return 'open-release-page'
  }

  return isReadyToRestart ? 'install' : 'download'
}

export function getUpdatePrimaryLabel(action: UpdatePrimaryAction, t: TFunction): string {
  switch (action) {
    case 'check':
      return t('updater.check')
    case 'open-release-page':
      return t('updater.go_to_download')
    case 'install':
      return t('updater.restart')
    case 'download':
    case 'none':
      return t('updater.update')
  }
}
