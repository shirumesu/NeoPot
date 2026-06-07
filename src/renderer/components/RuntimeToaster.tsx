import { Toaster } from 'react-hot-toast'

import { useToastStyle } from '@/renderer/hooks'

export default function RuntimeToaster() {
  const toastStyle = useToastStyle()

  return (
    <Toaster
      position="top-center"
      gutter={8}
      toastOptions={{
        style: {
          ...toastStyle,
          width: 'min(520px, calc(100vw - 32px))',
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
