import { semanticColors } from '@heroui/theme'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

type ToastStyle = {
  background: string
  color: string
  wordBreak: 'break-all'
  select: 'text'
}

type ToastPalette = {
  content1: { DEFAULT: string }
  foreground: { DEFAULT: string }
}

export const useToastStyle = (): ToastStyle => {
  const { theme } = useTheme()
  const palette = (theme === 'dark' ? semanticColors.dark : semanticColors.light) as ToastPalette

  return useMemo(
    () => ({
      background: palette.content1.DEFAULT,
      color: palette.foreground.DEFAULT,
      wordBreak: 'break-all',
      select: 'text',
    }),
    [palette],
  )
}
