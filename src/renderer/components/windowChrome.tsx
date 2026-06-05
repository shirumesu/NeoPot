import React from 'react'

import { osType } from '@/renderer/lib/config/env'

export const WINDOW_TOPBAR_HEIGHT_CLASS = 'h-8.75'
export const WINDOW_CONTROL_ICON_CLASS = 'text-[16px]'
export const PIN_ICON_CLASS = 'text-[20px]'

export const LINUX_WINDOW_FRAME_CLASS =
  osType === 'Linux' ? 'rounded-[10px] border-1 border-default-100' : ''

export const LINUX_LEFT_WINDOW_FRAME_CLASS = osType === 'Linux' ? 'rounded-l-[10px] border-1' : ''

export const LINUX_RIGHT_WINDOW_FRAME_CLASS =
  osType === 'Linux' ? 'rounded-r-[10px] border-1 border-l-0 border-default-100' : ''

export const LINUX_CLOSE_WINDOW_CORNER_CLASS = osType === 'Linux' ? 'rounded-tr-[10px]' : ''

interface DragRegionProps {
  className?: string
  children?: React.ReactNode
}

export function DragRegion({ className = '', children }: DragRegionProps) {
  return (
    <div data-tauri-drag-region="true" className={className}>
      {children}
    </div>
  )
}

export function TopDragRegion({ className = '' }: { className?: string }) {
  return <DragRegion className={`fixed top-1.25 left-1.25 right-1.25 h-7.5 ${className}`} />
}
