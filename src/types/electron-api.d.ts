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
    list(type: string): Promise<PluginInfo[]>
  }
}

declare global {
  interface Window {
    neoPot: NeoPotElectronApi
  }
}

export {}
