export interface SelectionPoint {
  x: number
  y: number
}

export interface CropRect {
  left: number
  top: number
  width: number
  height: number
}

export function calculateCropRect(
  start: SelectionPoint,
  end: SelectionPoint,
  viewportWidth: number,
  monitorWidth: number,
): CropRect | null {
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(monitorWidth) ||
    viewportWidth <= 0 ||
    monitorWidth <= 0
  ) {
    return null
  }

  const viewportScale = monitorWidth / viewportWidth
  const left = Math.floor(Math.min(start.x, end.x) * viewportScale)
  const top = Math.floor(Math.min(start.y, end.y) * viewportScale)
  const right = Math.floor(Math.max(start.x, end.x) * viewportScale)
  const bottom = Math.floor(Math.max(start.y, end.y) * viewportScale)
  const width = right - left
  const height = bottom - top

  if (width <= 0 || height <= 0) {
    return null
  }

  return { left, top, width, height }
}
