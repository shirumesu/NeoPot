import { shell } from 'electron'
import { assertSafeExternalUrl, type SafeExternalUrlOptions } from './externalUrlSafety'

export { assertSafeExternalUrl }

export async function safeOpenExternal(
  input: string,
  options: SafeExternalUrlOptions = {},
): Promise<void> {
  await shell.openExternal(assertSafeExternalUrl(input, options))
}
