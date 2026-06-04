import type { UpdateCheckResult, UpdateEvent, Unsubscribe } from '@/shared/types/electron-api'

export function check(): Promise<UpdateCheckResult> {
  return window.neoPot.updater.check()
}

export function download(): Promise<void> {
  return window.neoPot.updater.download()
}

export function install(): Promise<void> {
  return window.neoPot.updater.install()
}

export function openReleasePage(): Promise<void> {
  return window.neoPot.updater.openReleasePage()
}

export function onEvent(callback: (event: UpdateEvent) => void): Unsubscribe {
  return window.neoPot.updater.onEvent(callback)
}
