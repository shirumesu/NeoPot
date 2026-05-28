import { getCurrentWebviewWindow } from '@/utils/electron_compat/webviewWindow'
import { MemoryRouter } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { warn } from '@/utils/electron_compat/log'
import {
  useEffect,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useTheme } from 'next-themes'

import Screenshot from './window/Screenshot'
import Translate from './window/Translate'
import Recognize from './window/Recognize'
import Updater from './window/Updater'
import { store } from './utils/store.js'
import { electronCommand } from './utils/electron_command'
import Config from './window/Config'
import ErrorBoundary from './components/ErrorBoundary'
import { useConfig } from './hooks'
import './style.css'
import './i18n'

const appWindow = getCurrentWebviewWindow()

const windowMap: Record<string, ComponentType> = {
  translate: Translate as ComponentType,
  screenshot: Screenshot as ComponentType,
  recognize: Recognize as ComponentType,
  config: Config as ComponentType,
  updater: Updater as ComponentType,
}

const configRoutes = new Set([
  '/general',
  '/translate',
  '/recognize',
  '/hotkey',
  '/service',
  '/history',
  '/backup',
  '/about',
])

function normalizeConfigRoute(route: string | null) {
  if (!route) {
    return '/general'
  }

  const normalized = route.startsWith('/') ? route : `/${route}`
  return configRoutes.has(normalized) ? normalized : '/general'
}

function getInitialConfigRoute() {
  const hashRoute = window.location.hash.replace(/^#/, '')
  const queryRoute = new URLSearchParams(window.location.search).get('page')
  const pathRoute = window.location.pathname === '/' ? null : window.location.pathname

  return normalizeConfigRoute(hashRoute || queryRoute || pathRoute)
}

export default function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null)
  const [devMode] = useConfig<boolean>('dev_mode', false)
  const [appTheme] = useConfig<string>('app_theme', 'system')
  const [appLanguage] = useConfig<string>('app_language', 'en')
  const [appFont] = useConfig<string>('app_font', 'default')
  const [appFallbackFont] = useConfig<string>('app_fallback_font', 'default')
  const [appFontSize] = useConfig<number>('app_font_size', 16)
  const { setTheme } = useTheme()
  const { i18n } = useTranslation()

  useEffect(() => {
    if (store !== null) {
      void store.reload({ ignoreDefaults: true })
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function syncWindowLabel() {
      const label = window.neoPot ? await window.neoPot.app.getWindowLabel() : appWindow.label

      if (!cancelled) {
        setWindowLabel(label)
      }
    }

    void syncWindowLabel()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent | ReactKeyboardEvent) => {
      const allowKeys = ['c', 'v', 'x', 'a', 'z', 'y']
      if (e.ctrlKey && !allowKeys.includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      if (devMode && e.key === 'F12') {
        await electronCommand('open_devtools')
      }
      if (e.key.startsWith('F') && e.key.length > 1) {
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        if (window.neoPot) {
          await window.neoPot.app.closeCurrentWindow()
        } else {
          await appWindow.close()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [devMode])

  useEffect(() => {
    if (appTheme !== null) {
      if (appTheme !== 'system') {
        setTheme(appTheme)
      } else {
        try {
          const media = window.matchMedia('(prefers-color-scheme: dark)')
          setTheme(media.matches ? 'dark' : 'light')
          const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
          media.addEventListener('change', onChange)
          return () => media.removeEventListener('change', onChange)
        } catch {
          warn("Can't detect system theme.")
        }
      }
    }
    return undefined
  }, [appTheme, setTheme])

  useEffect(() => {
    if (appLanguage !== null) {
      void i18n.changeLanguage(appLanguage)
    }
  }, [appLanguage, i18n])

  useEffect(() => {
    if (appFont !== null && appFallbackFont !== null) {
      document.documentElement.style.fontFamily = `"${appFont === 'default' ? 'sans-serif' : appFont}","${
        appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont
      }"`
    }
    if (appFontSize !== null) {
      document.documentElement.style.fontSize = `${appFontSize}px`
    }
  }, [appFont, appFallbackFont, appFontSize])

  const label = windowLabel ?? appWindow.label
  const CurrentWindow = windowMap[label]

  if (!CurrentWindow) {
    return null
  }

  if (label === 'config') {
    return (
      <MemoryRouter
        initialEntries={[getInitialConfigRoute()]}
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
      >
        <ErrorBoundary fallbackTitle="Config window render failed">
          <CurrentWindow />
        </ErrorBoundary>
      </MemoryRouter>
    )
  }

  return (
    <ErrorBoundary fallbackTitle={`${label} window render failed`}>
      <CurrentWindow />
    </ErrorBoundary>
  )
}
