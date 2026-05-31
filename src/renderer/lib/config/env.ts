import { type, arch as archFn, version } from '@/renderer/lib/electron/compat/os'
import { getVersion } from '@/renderer/lib/electron/compat/app'

export let osType = ''
export let arch = ''
export let osVersion = ''
export let appVersion = ''

export async function initEnv() {
  osType = await type()
  arch = await archFn()
  osVersion = await version()
  appVersion = await getVersion()
}
