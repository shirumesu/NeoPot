import type { UpdateProgress } from '@/shared/types/electron-api'

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(value: number | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }

  if (value === 0) {
    return '0 B'
  }

  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < byteUnits.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const fractionDigits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2
  const formatted = size
    .toFixed(fractionDigits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')

  return `${formatted} ${byteUnits[unitIndex]}`
}

export function formatBytesPerSecond(value: number | undefined): string | null {
  const bytes = formatBytes(value)
  return bytes ? `${bytes}/s` : null
}

export function getProgressPercent(progress: UpdateProgress | null): number | undefined {
  if (!progress || typeof progress.percent !== 'number' || !Number.isFinite(progress.percent)) {
    return undefined
  }

  return Math.max(0, Math.min(100, progress.percent))
}
