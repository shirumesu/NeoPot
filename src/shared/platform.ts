export type RuntimePlatform = 'Windows_NT' | 'Darwin' | 'Linux'

export function runtimePlatform(platform: NodeJS.Platform): RuntimePlatform {
  if (platform === 'win32') {
    return 'Windows_NT'
  }
  if (platform === 'darwin') {
    return 'Darwin'
  }
  return 'Linux'
}
