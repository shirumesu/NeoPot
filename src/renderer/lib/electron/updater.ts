import type { UpdateCheckResult, UpdateEvent, Unsubscribe } from '@/shared/types/electron-api'

export function checkForUpdates(): Promise<UpdateCheckResult> {
  return window.neoPot.updater.check()
}

export function downloadUpdate(): Promise<void> {
  return window.neoPot.updater.download()
}

export function installUpdate(): Promise<void> {
  return window.neoPot.updater.install()
}

export function openReleasePage(): Promise<void> {
  return window.neoPot.updater.openReleasePage()
}

export function onUpdateEvent(callback: (event: UpdateEvent) => void): Unsubscribe {
  return window.neoPot.updater.onEvent(callback)
}
