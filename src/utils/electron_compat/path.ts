const joinSegments = (...segments: string[]) => segments.filter(Boolean).join('/')

export async function appConfigDir() {
  return (await window.neoPot?.path?.appConfigDir()) ?? ''
}

export async function appCacheDir() {
  return (await window.neoPot?.path?.appCacheDir()) ?? ''
}

export async function appLogDir() {
  return ''
}

export async function join(...segments: string[]) {
  return joinSegments(...segments)
}
