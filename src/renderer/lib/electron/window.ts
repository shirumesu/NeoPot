interface CurrentWindow {
  close(): Promise<void>
  hide(): Promise<void>
  show(): Promise<void>
  setFocus(_focus?: boolean): Promise<void>
  setAlwaysOnTop(_alwaysOnTop: boolean): Promise<void>
  setResizable(_resizable: boolean): Promise<void>
  setSize(_size: { width: number; height: number }): Promise<void>
  setPosition(_position: { x: number; y: number }): Promise<void>
  outerPosition(): Promise<{ x: number; y: number }>
  outerSize(): Promise<{ width: number; height: number }>
  isMaximized(): Promise<boolean>
  minimize(): Promise<void>
  maximize(): Promise<void>
  unmaximize(): Promise<void>
  getDisplay(): Promise<{
    id: number
    position: { x: number; y: number }
    size: { width: number; height: number }
    scaleFactor: number
  }>
}

export function getCurrentWindow(): CurrentWindow {
  return {
    close: () => window.neoPot.app.closeCurrentWindow(),
    hide: () => window.neoPot.app.hideCurrentWindow(),
    show: () => window.neoPot.app.showCurrentWindow(),
    setFocus: () => window.neoPot.app.focusCurrentWindow(),
    setAlwaysOnTop: (alwaysOnTop) => window.neoPot.app.setCurrentWindowAlwaysOnTop(alwaysOnTop),
    setResizable: (resizable) => window.neoPot.app.setCurrentWindowResizable(resizable),
    setSize: ({ width, height }) => window.neoPot.app.setCurrentWindowBounds({ width, height }),
    setPosition: ({ x, y }) => window.neoPot.app.setCurrentWindowBounds({ x, y }),
    outerPosition: async () => {
      const bounds = await window.neoPot.app.getCurrentWindowBounds()
      return {
        x: bounds.x,
        y: bounds.y,
      }
    },
    outerSize: async () => {
      const bounds = await window.neoPot.app.getCurrentWindowBounds()
      return {
        width: bounds.width,
        height: bounds.height,
      }
    },
    isMaximized: () => window.neoPot.app.isCurrentWindowMaximized(),
    minimize: () => window.neoPot.app.minimizeCurrentWindow(),
    maximize: () => window.neoPot.app.maximizeCurrentWindow(),
    unmaximize: () => window.neoPot.app.unmaximizeCurrentWindow(),
    getDisplay: () => window.neoPot.app.getCurrentDisplay(),
  }
}
