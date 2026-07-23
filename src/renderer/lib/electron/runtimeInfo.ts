export function getRuntimeArchitecture() {
  return navigator.userAgent.includes('ARM') ? 'arm64' : 'x86_64'
}

export function getRuntimeVersion() {
  return navigator.userAgent
}
