import { invokeCommand } from './command'

export async function openUrl(url: string) {
  if (!url) {
    return
  }

  await invokeCommand('open_url', { url })
}
