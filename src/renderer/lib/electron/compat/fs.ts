export enum BaseDirectory {
  AppConfig = 'AppConfig',
  AppCache = 'AppCache',
  AppLog = 'AppLog',
}

export async function readDir(path: string, options?: Record<string, unknown>) {
  return (await window.neoPot?.fs?.readDir(path, options)) ?? []
}

export async function readTextFile(path: string, options?: Record<string, unknown>) {
  return (await window.neoPot?.fs?.readTextFile(path, options)) ?? ''
}

export async function readFile(path: string, options?: Record<string, unknown>) {
  const bytes = (await window.neoPot?.fs?.readFile(path, options)) ?? []
  return new Uint8Array(bytes)
}

export async function exists(path: string, options?: Record<string, unknown>) {
  return (await window.neoPot?.fs?.exists(path, options)) ?? false
}

export async function remove(path: string, options?: Record<string, unknown>) {
  await window.neoPot?.fs?.remove(path, options)
}

export async function watch(_path?: string, _handler?: (...args: unknown[]) => void) {
  return () => {}
}
