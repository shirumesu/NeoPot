export async function getAppConfigDirectory() {
  return window.neoPot.path.appConfigDir()
}

export async function getAppCacheDirectory() {
  return window.neoPot.path.appCacheDir()
}

export function joinPath(...segments: string[]) {
  return segments.filter(Boolean).join('/')
}
