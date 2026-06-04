export async function currentMonitor() {
  return (
    window.neoPot?.app?.getCurrentDisplay?.() ?? {
      id: 0,
      position: { x: 0, y: 0 },
      size: { width: window.screen.width, height: window.screen.height },
      scaleFactor: window.devicePixelRatio || 1,
    }
  )
}
