import { semanticColors } from '@heroui/theme'
import { useTheme } from 'next-themes'
import { Toaster } from 'react-hot-toast'

type ToastPalette = {
  content1: { DEFAULT: string }
  foreground: { DEFAULT: string }
}

export default function RuntimeToaster() {
  const { theme } = useTheme()
  const palette = (theme === 'dark' ? semanticColors.dark : semanticColors.light) as ToastPalette

  return (
    <Toaster
      position="top-center"
      gutter={8}
      toastOptions={{
        style: {
          background: palette.content1.DEFAULT,
          color: palette.foreground.DEFAULT,
          maxWidth: 'min(520px, calc(100vw - 32px))',
          padding: '10px 12px',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
        },
        error: {
          duration: 5000,
        },
      }}
    />
  )
}
