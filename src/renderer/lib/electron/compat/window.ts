export async function currentMonitor() {
  return {
    position: { x: 0, y: 0 },
    size: { width: window.screen.width, height: window.screen.height },
    scaleFactor: window.devicePixelRatio || 1,
  }
}
