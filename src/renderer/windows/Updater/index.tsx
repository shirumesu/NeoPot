import { Button, Card, CardBody, Code, Progress, Skeleton } from '@heroui/react'
import React, { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import type { UpdateCheckResult, UpdateEvent, UpdateProgress } from '@/shared/types/electron-api'
import {
  check,
  download,
  install,
  onEvent,
  openReleasePage,
} from '@/renderer/lib/electron/compat/updater'
import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { osType } from '@/renderer/lib/config/env'
import { useToastStyle } from '../../hooks'

const appWindow = getCurrentWebviewWindow()

function isNotificationPresentation() {
  return new URLSearchParams(window.location.search).get('presentation') === 'notification'
}

function progressValue(progress: UpdateProgress | null): number | undefined {
  if (!progress || typeof progress.percent !== 'number') {
    return undefined
  }

  return Math.max(0, Math.min(100, progress.percent))
}

export default function Updater() {
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [isChecking, setIsChecking] = useState(!isNotificationPresentation())
  const [isWorking, setIsWorking] = useState(false)
  const [statusText, setStatusText] = useState('')
  const isNotification = useMemo(() => isNotificationPresentation(), [])
  const { t } = useTranslation()
  const toastStyle = useToastStyle()

  useEffect(() => {
    if (appWindow.label === 'updater') {
      appWindow.show()
    }

    const unsubscribeUpdate = onEvent((event: UpdateEvent) => {
      if (event.type === 'checking') {
        setIsChecking(true)
        setStatusText(t('updater.checking'))
        return
      }

      if (event.type === 'download-progress') {
        setProgress(event.progress)
        setIsWorking(true)
        setStatusText(t('updater.downloading'))
        return
      }

      if (event.type === 'downloaded') {
        setResult(event.result)
        setIsWorking(false)
        setStatusText(t('updater.ready_restart'))
        return
      }

      if (event.type === 'installing') {
        setIsWorking(true)
        setStatusText(t('updater.installing'))
        return
      }

      if (event.type === 'error') {
        setIsChecking(false)
        setIsWorking(false)
        setStatusText(event.message)
        toast.error(event.message, { style: toastStyle })
        return
      }

      setIsChecking(false)
      setResult(event.result)
      setStatusText('')
    })

    const unsubscribeStartup = window.neoPot.app.onEvent('startup_update_available', (payload) => {
      const nextResult = payload as UpdateCheckResult
      setResult(nextResult)
      setIsChecking(false)
    })

    if (!isNotification) {
      void refresh()
    }

    return () => {
      unsubscribeUpdate()
      unsubscribeStartup()
    }
  }, [isNotification, t, toastStyle])

  const refresh = async () => {
    setIsChecking(true)
    setProgress(null)
    setStatusText(t('updater.checking'))

    const nextResult = await check()
    setResult(nextResult)
    setIsChecking(false)
    setStatusText('')

    if (nextResult.status === 'error') {
      toast.error(nextResult.message ?? t('updater.error'), { style: toastStyle })
    }
  }

  const primaryAction = async () => {
    if (!result) {
      await refresh()
      return
    }

    if (result.mode === 'manual-download') {
      await openReleasePage()
      return
    }

    if (statusText === t('updater.ready_restart')) {
      setIsWorking(true)
      await install()
      return
    }

    setIsWorking(true)
    await download()
  }

  const releaseNotes =
    result?.releaseNotes ||
    (result?.status === 'not-available'
      ? t('updater.latest')
      : result?.status === 'unsupported'
        ? t('updater.unsupported')
        : result?.status === 'error'
          ? result.message || t('updater.error')
          : '')

  const primaryLabel = !result
    ? t('updater.check')
    : result.mode === 'manual-download'
      ? t('updater.go_to_download')
      : statusText === t('updater.ready_restart')
        ? t('updater.restart')
        : t('updater.update')
  const primaryDisabled =
    isChecking ||
    isWorking ||
    (result !== null &&
      result.status !== 'available' &&
      result.status !== 'error' &&
      result.status !== 'unsupported')

  if (isNotification) {
    return (
      <div
        className={`bg-background h-screen p-4 select-none ${
          osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
        }`}
      >
        <Toaster />
        <div className="flex items-center gap-2">
          <img src="icon.png" className="h-7 w-7" draggable={false} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-5">{t('updater.title')}</h2>
            <p className="text-xs text-default-500 truncate">
              {result?.version
                ? t('updater.version_available', { version: result.version })
                : statusText}
            </p>
          </div>
        </div>
        <p className="mt-4 h-14 text-sm text-default-600 line-clamp-3">
          {statusText || result?.releaseName || t('updater.available')}
        </p>
        {progress && (
          <Progress
            aria-label={t('updater.progress')}
            value={progressValue(progress)}
            isIndeterminate={progressValue(progress) === undefined}
            size="sm"
            className="mb-3"
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="sm"
            color="primary"
            isLoading={isWorking}
            isDisabled={!result || result.status !== 'available'}
            onPress={primaryAction}
          >
            {primaryLabel}
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              appWindow.close()
            }}
          >
            {t('updater.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-background h-screen ${
        osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
      }`}
    >
      <Toaster />
      <div className="p-1.25 h-8.75 w-full select-none cursor-default">
        <div
          data-tauri-drag-region="true"
          className={`h-full w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-start'}`}
        >
          <img src="icon.png" className="h-6.25 w-6.25 mr-2.5" draggable={false} />
          <h2>{t('updater.title')}</h2>
        </div>
      </div>
      <Card className="mx-20 mt-2.5 overscroll-auto h-[calc(100vh-150px)]">
        <CardBody>
          {isChecking && !releaseNotes ? (
            <div className="space-y-3">
              <Skeleton className="w-3/5 rounded-lg">
                <div className="h-3 w-3/5 rounded-lg bg-default-200"></div>
              </Skeleton>
              <Skeleton className="w-4/5 rounded-lg">
                <div className="h-3 w-4/5 rounded-lg bg-default-200"></div>
              </Skeleton>
              <Skeleton className="w-2/5 rounded-lg">
                <div className="h-3 w-2/5 rounded-lg bg-default-300"></div>
              </Skeleton>
            </div>
          ) : (
            <div className="markdown-body select-text">
              <ReactMarkdown
                components={{
                  code: ({ node: _node, ...props }) => {
                    const { children } = props
                    return <Code size="sm">{children}</Code>
                  },
                  h2: ({ node: _node, ...props }) => (
                    <b>
                      <h2 className="text-[24px]" {...props} />
                      <hr />
                      <br />
                    </b>
                  ),
                  h3: ({ node: _node, ...props }) => (
                    <b>
                      <br />
                      <h3 className="text-[18px]" {...props} />
                      <br />
                    </b>
                  ),
                  li: ({ node: _node, ...props }) => {
                    const { children } = props
                    return <li className="list-disc list-inside" children={children} />
                  },
                }}
              >
                {releaseNotes || statusText}
              </ReactMarkdown>
            </div>
          )}
        </CardBody>
      </Card>
      {(isWorking || progress) && (
        <Progress
          aria-label={t('updater.progress')}
          label={t('updater.progress')}
          value={progressValue(progress)}
          isIndeterminate={progressValue(progress) === undefined}
          classNames={{
            base: 'w-full px-[80px]',
            track: 'drop-shadow-md border border-default',
            indicator: 'bg-linear-to-r from-pink-500 to-yellow-500',
            label: 'tracking-wider font-medium text-default-600',
            value: 'text-foreground/60',
          }}
          showValueLabel
          size="sm"
        />
      )}

      <div className="grid gap-4 grid-cols-2 h-12.5 my-2.5 mx-20">
        <Button
          variant="flat"
          isLoading={isWorking || isChecking}
          isDisabled={primaryDisabled}
          color="primary"
          onPress={primaryAction}
        >
          {isWorking ? statusText || t('updater.downloading') : primaryLabel}
        </Button>
        <Button
          variant="flat"
          color="danger"
          onPress={() => {
            appWindow.close()
          }}
        >
          {t('updater.cancel')}
        </Button>
      </div>
    </div>
  )
}
