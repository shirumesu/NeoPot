import { useLocation, useRoutes } from 'react-router-dom'
import React, { useEffect } from 'react'
import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { Card, Divider } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'react-hot-toast'

import ErrorBoundary from '../../components/ErrorBoundary'
import WindowControl from '../../components/WindowControl'
import SideBar from './components/SideBar'
import { osType } from '@/renderer/lib/config/env'
import {
  DragRegion,
  LINUX_LEFT_WINDOW_FRAME_CLASS,
  LINUX_RIGHT_WINDOW_FRAME_CLASS,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import routes from './routes'
import './style.css'
const appWindow = getCurrentWebviewWindow()

export default function Config() {
  const { t } = useTranslation()
  const location = useLocation()
  const page = useRoutes(routes)
  const pageTitleKey = location.pathname === '/' ? 'general' : location.pathname.slice(1)

  useEffect(() => {
    if (appWindow.label === 'config') {
      appWindow.show()
      void window.neoPot?.app.rendererReady()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Toaster position="top-center" />
      <Card
        shadow="none"
        className={`h-screen w-57.5 shrink-0 rounded-none bg-content1 ${LINUX_LEFT_WINDOW_FRAME_CLASS} border-r-1 border-default-100 select-none cursor-default`}
      >
        <div className={`${WINDOW_TOPBAR_HEIGHT_CLASS} p-1.25`}>
          <DragRegion className="h-full w-full" />
        </div>
        <div className="p-1.25">
          <DragRegion>
            <img
              alt={t('accessibility.app_logo')}
              src="icon.svg"
              className="h-15 w-15 m-auto mb-7.5"
              draggable={false}
            />
          </DragRegion>
        </div>
        <SideBar />
      </Card>
      <div
        className={`flex h-screen min-w-0 flex-1 flex-col bg-background ${LINUX_RIGHT_WINDOW_FRAME_CLASS} select-none cursor-default`}
      >
        <DragRegion className="fixed top-1.25 left-58.75 right-1.25 h-7.5" />
        <div className={`${WINDOW_TOPBAR_HEIGHT_CLASS} flex justify-between`}>
          <div className="flex">
            <h2 className="m-auto ml-2.5">{t(`config.${pageTitleKey}.title`)}</h2>
          </div>

          <div className="flex">{osType !== 'Darwin' && <WindowControl />}</div>
        </div>
        <Divider />
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          <ErrorBoundary fallbackTitle={t('errors.config_page_render_failed')}>
            {page ?? (
              <div className="rounded-medium border border-warning/30 bg-warning/10 p-4 text-sm text-warning-700">
                {t('errors.config_route_missing', { route: location.pathname })}
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
