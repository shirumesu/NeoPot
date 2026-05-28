const joinSegments = (...segments: string[]) => segments.filter(Boolean).join('/')

export async function appConfigDir() {
  return ''
}

export async function appCacheDir() {
  return ''
}

export async function appLogDir() {
  return ''
}

export async function join(...segments: string[]) {
  return joinSegments(...segments)
}
