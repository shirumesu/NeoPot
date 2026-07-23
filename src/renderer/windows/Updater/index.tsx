import { Button, Progress } from '@heroui/react'
import { useCallback, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import WindowControl from '@/renderer/components/WindowControl'
import {
  DragRegion,
  LINUX_WINDOW_FRAME_CLASS,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { appVersion, osType } from '@/renderer/lib/config/env'
import { formatBytes, formatBytesPerSecond, getProgressPercent } from './formatProgress'
import { getUpdatePrimaryLabel } from './updateActions'
import { UpdaterPanel } from './UpdaterPanel'
import { useUpdaterController, type UpdaterController } from './useUpdaterController'

const appWindow = getCurrentWindow()

function isNotificationPresentation() {
  return new URLSearchParams(window.location.search).get('presentation') === 'notification'
}

function notificationStatus(
  controller: UpdaterController,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (controller.phase === 'checking') {
    return t('updater.checking')
  }

  if (controller.phase === 'downloading') {
    return t('updater.downloading')
  }

  if (controller.phase === 'ready-restart') {
    return t('updater.ready_restart')
  }

  if (controller.phase === 'installing') {
    return t('updater.installing')
  }

  if (controller.message) {
    return controller.message
  }

  if (controller.result?.status === 'available') {
    return controller.result.releaseName || t('updater.available')
  }

  if (controller.result?.status === 'not-available') {
    return t('updater.latest_plain')
  }

  if (controller.result?.status === 'unsupported') {
    return t('updater.unsupported_title')
  }

  if (controller.result?.status === 'error') {
    return controller.result.message || t('updater.error')
  }

  return t('updater.available')
}

function NotificationProgress({ controller }: { controller: UpdaterController }) {
  const { t } = useTranslation()
  const progress = controller.progress
  const percent = getProgressPercent(progress)
  const transferred = formatBytes(progress?.transferred)
  const total = formatBytes(progress?.total)
  const speed = formatBytesPerSecond(progress?.bytesPerSecond)

  if (!progress && !controller.isWorking) {
    return null
  }

  const detail = [transferred && total ? `${transferred} / ${total}` : transferred, speed]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mb-3 space-y-1">
      <Progress
        aria-label={t('updater.progress')}
        value={percent}
        isIndeterminate={percent === undefined}
        size="sm"
      />
      {detail && <p className="truncate text-xs text-default-500">{detail}</p>}
    </div>
  )
}

function UpdaterNotification({ controller }: { controller: UpdaterController }) {
  const { t } = useTranslation()

  return (
    <div
      className={`flex h-screen flex-col bg-background p-4 select-none ${LINUX_WINDOW_FRAME_CLASS}`}
    >
      <DragRegion className="mb-3 flex items-center gap-2">
        <img src="icon.png" className="h-7 w-7" draggable={false} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-5">{t('updater.title')}</h2>
          <p className="truncate text-xs text-default-500">
            {controller.result?.version
              ? t('updater.version_available', { version: controller.result.version })
              : t('updater.current_version', { version: appVersion })}
          </p>
        </div>
      </DragRegion>
      <p className="mb-3 min-h-0 flex-1 text-sm text-default-600 line-clamp-3">
        {notificationStatus(controller, t)}
      </p>
      <NotificationProgress controller={controller} />
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="sm"
          color="primary"
          isLoading={controller.isChecking || controller.isWorking}
          isDisabled={controller.primaryDisabled}
          onPress={() => void controller.runPrimaryAction()}
        >
          {getUpdatePrimaryLabel(controller.primaryAction, t)}
        </Button>
        <Button size="sm" variant="flat" onPress={() => void appWindow.close()}>
          {t('updater.cancel')}
        </Button>
      </div>
    </div>
  )
}

function UpdaterHeader() {
  const { t } = useTranslation()

  return (
    <div
      className={`${WINDOW_TOPBAR_HEIGHT_CLASS} flex shrink-0 items-center border-b border-default-200`}
    >
      <DragRegion className="flex h-full min-w-0 flex-1 items-center gap-2 px-4">
        <img src="icon.png" className="h-6 w-6" draggable={false} />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold leading-5">{t('updater.title')}</h2>
          <p className="truncate text-xs text-default-500">
            {t('updater.current_version', { version: appVersion })}
          </p>
        </div>
      </DragRegion>
      {osType !== 'Darwin' && <WindowControl />}
    </div>
  )
}

export default function Updater() {
  const isNotification = useMemo(() => isNotificationPresentation(), [])
  const showError = useCallback((message: string) => {
    toast.error(message)
  }, [])
  const controller = useUpdaterController({
    autoCheck: !isNotification,
    onError: showError,
  })

  useEffect(() => {
    void appWindow.show()
    void window.neoPot.app.rendererReady()
  }, [])

  if (isNotification) {
    return <UpdaterNotification controller={controller} />
  }

  return (
    <div className={`flex h-screen flex-col bg-background ${LINUX_WINDOW_FRAME_CLASS}`}>
      <UpdaterHeader />
      <main className="min-h-0 flex-1 p-4">
        <UpdaterPanel controller={controller} onCancel={() => void appWindow.close()} />
      </main>
    </div>
  )
}
