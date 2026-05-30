import path from 'node:path'

// Custom scheme used to load the packaged renderer. Packaged builds must not be
// served over `file:` because PaddleOCR.js (`ensureServedFromHttp`) throws on a
// `file:` origin; serving over `neopot://` gives a non-`file:` origin while
// still reading the bundled files from disk.
export const RENDERER_SCHEME = 'neopot'
export const RENDERER_HOST = 'main_window'

// Maps a `neopot://main_window/...` request URL onto an absolute file path
// inside the packaged renderer root, or returns null when the request is
// invalid or attempts to escape the root. Pure (no filesystem access) so it can
// be unit-tested directly.
export function resolveRendererFile(requestUrl: string, rendererRoot: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(requestUrl)
  } catch {
    return null
  }

  if (parsed.protocol !== `${RENDERER_SCHEME}:` || parsed.hostname !== RENDERER_HOST) {
    return null
  }

  let pathname: string
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }

  if (pathname.includes('\0')) {
    return null
  }

  const relative = pathname.replace(/^\/+/, '')
  const root = path.resolve(rendererRoot)
  const resolved = relative === '' ? path.join(root, 'index.html') : path.resolve(root, relative)

  // Final containment guard: even after decoding, the resolved path must stay
  // inside the renderer root (defends against encoded `..` traversal).
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    return null
  }

  return resolved
}
