import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import ReactDOM from 'react-dom/client'

import { initStore } from '@/renderer/lib/config/store'
import { initEnv } from '@/renderer/lib/config/env'
import { applyConfiguredRendererLogLevel } from '@/renderer/lib/electron/logLevel'
import { logger } from '@/renderer/lib/logger'
import App from './App'

if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })
}

function renderFatalError(error: unknown) {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element "#root" was not found')
  }

  const root = ReactDOM.createRoot(rootElement)
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

  root.render(
    <pre
      style={{
        margin: 0,
        padding: '16px',
        whiteSpace: 'pre-wrap',
        fontFamily: 'Consolas, monospace',
      }}
    >
      {`Frontend startup failed\n\n${message}`}
    </pre>,
  )
}

window.addEventListener('error', (event) => {
  logger.error('Unhandled window error.', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection.', event.reason)
})

async function bootstrap() {
  try {
    await initStore()
    await applyConfiguredRendererLogLevel()
    await initEnv()
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element "#root" was not found')
    }

    const root = ReactDOM.createRoot(rootElement)
    root.render(
      <HeroUIProvider>
        <NextThemesProvider attribute="class">
          <App />
        </NextThemesProvider>
      </HeroUIProvider>,
    )
  } catch (error) {
    logger.error('Bootstrap failed.', error)
    renderFatalError(error)
    try {
      await getCurrentWebviewWindow().show()
      await getCurrentWebviewWindow().setFocus()
    } catch (showError) {
      logger.error('Failed to reveal error window.', showError)
    }
  }
}

void bootstrap()
