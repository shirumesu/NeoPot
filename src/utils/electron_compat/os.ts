export async function type() {
  return navigator.platform.includes('Win') ? 'windows' : navigator.platform
}

export async function arch() {
  return navigator.userAgent.includes('ARM') ? 'arm64' : 'x86_64'
}

export async function version() {
  return navigator.userAgent
}
