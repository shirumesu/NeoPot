import { getRuntimeArchitecture, getRuntimeVersion } from '@/renderer/lib/electron/runtimeInfo'
import { getAppVersion } from '@/renderer/lib/electron/app'

export const osType = window.neoPot.app.platform
export let arch = ''
export let osVersion = ''
export let appVersion = ''

export async function initEnv() {
  arch = getRuntimeArchitecture()
  osVersion = getRuntimeVersion()
  appVersion = await getAppVersion()
}
