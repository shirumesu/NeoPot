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

export type StreamCallback = (payload: unknown) => void
export type Unsubscribe = () => void

export interface WindowBounds {
  x?: number
  y?: number
  width?: number
  height?: number
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
  services: {
    translate(request: TranslateRequest): Promise<TranslateResult>
    onStream(eventId: string, callback: StreamCallback): Unsubscribe
  }
  plugins: {
    install(file: string): Promise<PluginInstallResult>
    installFromUrl(url: string): Promise<PluginInstallResult>
    inspectSource(url: string): Promise<PluginInfo>
    list(type: string): Promise<PluginInfo[]>
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
