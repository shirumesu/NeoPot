import type { RuntimePlatform } from '../platform'

export type WindowLabel = 'config' | 'translate' | 'recognize' | 'screenshot' | 'updater'

export interface TranslateRequest {
  [key: string]: unknown
}

export interface TranslateResult {
  [key: string]: unknown
}

export interface PluginInstallResult {
  [key: string]: unknown
}

export interface PluginInfo {
  [key: string]: unknown
}

export interface PluginMarketplaceEntry {
  id: string
  type: string
  name: string
  display: string
  version: string
  author: string
  description: string
  repo: string
  download: string
  dev?: string
}

export type StreamCallback = (payload: unknown) => void
export type Unsubscribe = () => void

export type HttpRequestBody =
  | { kind: 'json'; data: unknown }
  | { kind: 'text'; data: string }
  | { kind: 'form'; data: Record<string, unknown> }

export interface HttpRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  body?: HttpRequestBody | string | null
  responseType?: 'json' | 'text' | 'arrayBuffer'
  timeoutMs?: number
}

export interface HttpResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
}

export type HttpStreamEvent =
  | {
      type: 'response'
      ok: boolean
      status: number
      statusText: string
      headers: Record<string, string>
      data?: unknown
      streaming: boolean
    }
  | { type: 'chunk'; data: Uint8Array }
  | { type: 'end' }
  | { type: 'error'; message: string }

export type UpdateDistribution = 'installer' | 'portable' | 'appimage' | 'deb-rpm' | 'unknown'
export type UpdateMode = 'self-update' | 'manual-download'
export type UpdateStatus = 'available' | 'not-available' | 'unsupported' | 'error'

export interface UpdateProgress {
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}

export interface UpdateCheckResult {
  status: UpdateStatus
  distribution: UpdateDistribution
  mode: UpdateMode
  currentVersion: string
  version?: string
  releaseName?: string
  releaseNotes?: string
  releasePageUrl?: string
  message?: string
}

export type UpdateEvent =
  | { type: 'checking'; result?: never; progress?: never; message?: never }
  | { type: 'available'; result: UpdateCheckResult; progress?: never; message?: never }
  | { type: 'not-available'; result: UpdateCheckResult; progress?: never; message?: never }
  | { type: 'unsupported'; result: UpdateCheckResult; progress?: never; message?: never }
  | { type: 'error'; result?: UpdateCheckResult; progress?: never; message: string }
  | { type: 'download-progress'; progress: UpdateProgress; result?: never; message?: never }
  | { type: 'downloaded'; result: UpdateCheckResult; progress?: never; message?: never }
  | { type: 'installing'; result?: never; progress?: never; message?: never }

export interface WindowBounds {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface DisplayInfo {
  id: number
  position: { x: number; y: number }
  size: { width: number; height: number }
  scaleFactor: number
}

export interface OpenDialogOptions {
  multiple?: boolean
  directory?: boolean
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface FsOptions {
  baseDir?: 'AppConfig' | 'AppCache' | 'AppLog'
  recursive?: boolean
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
}

export interface NeoPotElectronApi {
  app: {
    platform: RuntimePlatform
    getWindowLabel(): Promise<WindowLabel>
    getVersion(): Promise<string>
    rendererReady(): Promise<void>
    closeCurrentWindow(): Promise<void>
    hideCurrentWindow(): Promise<void>
    showCurrentWindow(): Promise<void>
    focusCurrentWindow(): Promise<void>
    setCurrentWindowAlwaysOnTop(alwaysOnTop: boolean): Promise<void>
    setCurrentWindowResizable(resizable: boolean): Promise<void>
    setCurrentWindowBounds(bounds: WindowBounds): Promise<void>
    getCurrentWindowBounds(): Promise<Required<WindowBounds>>
    getCurrentDisplay(): Promise<DisplayInfo>
    isCurrentWindowMaximized(): Promise<boolean>
    setAutoStart(enabled: boolean): Promise<void>
    isAutoStartEnabled(): Promise<boolean>
    minimizeCurrentWindow(): Promise<void>
    maximizeCurrentWindow(): Promise<void>
    unmaximizeCurrentWindow(): Promise<void>
    emit(event: string, payload?: unknown): Promise<void>
    onEvent(event: string, callback: StreamCallback): Unsubscribe
  }
  dialog: {
    open(options?: OpenDialogOptions): Promise<string | string[] | null>
  }
  fs: {
    readDir(path: string, options?: FsOptions): Promise<DirectoryEntry[]>
    readTextFile(path: string, options?: FsOptions): Promise<string>
    readFile(path: string, options?: FsOptions): Promise<number[]>
    exists(path: string, options?: FsOptions): Promise<boolean>
    remove(path: string, options?: FsOptions): Promise<void>
  }
  path: {
    appConfigDir(): Promise<string>
    appCacheDir(): Promise<string>
  }
  hotkey: {
    register(name: string, shortcut: string): Promise<boolean>
    unregister(shortcut: string): Promise<void>
    isRegistered(shortcut: string): Promise<boolean>
  }
  command: {
    invoke<TResponse = unknown>(
      command: string,
      payload?: Record<string, unknown>,
    ): Promise<TResponse>
  }
  http: {
    request(request: HttpRequest): Promise<HttpResponse>
    stream(request: HttpRequest, callback: (event: HttpStreamEvent) => void): Unsubscribe
  }
  config: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
  }
  workflow: {
    selectionTranslate(): Promise<void>
    inputTranslate(): Promise<void>
    ocrRecognize(): Promise<void>
    ocrTranslate(): Promise<void>
  }
  updater: {
    check(): Promise<UpdateCheckResult>
    download(): Promise<void>
    install(): Promise<void>
    openReleasePage(): Promise<void>
    onEvent(callback: (event: UpdateEvent) => void): Unsubscribe
  }
  services: {
    translate(request: TranslateRequest): Promise<TranslateResult>
  }
  plugins: {
    install(file: string): Promise<PluginInstallResult>
    installFromUrl(url: string): Promise<PluginInstallResult>
    inspectSource(url: string): Promise<PluginInfo>
    inspectMarketplace(url: string): Promise<PluginMarketplaceEntry[]>
    listInstalled(type?: string): Promise<PluginInfo[]>
    uninstall(type: string, name: string): Promise<void>
    setEnabled(type: string, name: string, enabled: boolean): Promise<void>
    openFolder(): Promise<string>
  }
}

declare global {
  interface Window {
    neoPot: NeoPotElectronApi
  }
}

export {}
