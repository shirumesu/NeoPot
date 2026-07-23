import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import ReactDOM from 'react-dom/client'

import { initStore } from '@/renderer/lib/config/store'
import { initEnv } from '@/renderer/lib/config/env'
import { applyConfiguredRendererLogLevel } from '@/renderer/lib/electron/logLevel'
import { logger } from '@/renderer/lib/logger'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'
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
  reportRuntimeError(event.error ?? event.message, {
    source: 'renderer.window.error',
    logMessage: 'Unhandled window error.',
  })
})

window.addEventListener('unhandledrejection', (event) => {
  reportRuntimeError(event.reason, {
    source: 'renderer.window.unhandledrejection',
    logMessage: 'Unhandled promise rejection.',
  })
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
      await getCurrentWindow().show()
      await getCurrentWindow().setFocus()
    } catch (showError) {
      logger.error('Failed to reveal error window.', showError)
    }
  }
}

void bootstrap()
