import { Button, Card, CardBody, Code, Progress, Skeleton } from '@heroui/react'
import React, { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
import { getUpdatePrimaryAction } from './updateActions'
import {
  DragRegion,
  LINUX_WINDOW_FRAME_CLASS,
  WINDOW_TOPBAR_HEIGHT_CLASS,
} from '@/renderer/components/windowChrome'
import { normalizeReleaseNotes } from './releaseNotes'

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

interface UpdaterHeaderProps {
  title: string
  subtitle?: string
  compact?: boolean
}

function UpdaterHeader({ title, subtitle, compact = false }: UpdaterHeaderProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <img src="icon.png" className="h-7 w-7" draggable={false} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-5">{title}</h2>
          {subtitle && <p className="truncate text-xs text-default-500">{subtitle}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={`p-1.25 ${WINDOW_TOPBAR_HEIGHT_CLASS} w-full select-none cursor-default`}>
      <DragRegion
        className={`flex h-full w-full ${osType === 'Darwin' ? 'justify-end' : 'justify-start'}`}
      >
        <img src="icon.png" className="mr-2.5 h-6.25 w-6.25" draggable={false} />
        <h2>{title}</h2>
      </DragRegion>
    </div>
  )
}

interface UpdaterProgressProps {
  progress: UpdateProgress | null
  progressLabel: string
  compact?: boolean
  isWorking?: boolean
}

function UpdaterProgress({
  progress,
  progressLabel,
  compact = false,
  isWorking,
}: UpdaterProgressProps) {
  if (!progress && !isWorking) {
    return null
  }

  const value = progressValue(progress)

  return (
    <Progress
      aria-label={progressLabel}
      label={compact ? undefined : progressLabel}
      value={value}
      isIndeterminate={value === undefined}
      className={compact ? 'mb-3' : undefined}
      classNames={
        compact
          ? undefined
          : {
              base: 'w-full px-[80px]',
              track: 'drop-shadow-md border border-default',
              indicator: 'bg-linear-to-r from-pink-500 to-yellow-500',
              label: 'tracking-wider font-medium text-default-600',
              value: 'text-foreground/60',
            }
      }
      showValueLabel={!compact}
      size="sm"
    />
  )
}

interface UpdaterActionsProps {
  primaryLabel: string
  cancelLabel: string
  isWorking: boolean
  isChecking?: boolean
  primaryDisabled: boolean
  onPrimary: () => void
  onCancel: () => void
  compact?: boolean
  workingLabel?: string
}

function UpdaterActions({
  primaryLabel,
  cancelLabel,
  isWorking,
  isChecking = false,
  primaryDisabled,
  onPrimary,
  onCancel,
  compact = false,
  workingLabel,
}: UpdaterActionsProps) {
  return (
    <div
      className={compact ? 'grid grid-cols-2 gap-3' : 'mx-20 my-2.5 grid h-12.5 grid-cols-2 gap-4'}
    >
      <Button
        size={compact ? 'sm' : undefined}
        variant={compact ? undefined : 'flat'}
        color="primary"
        isLoading={compact ? isWorking : isWorking || isChecking}
        isDisabled={primaryDisabled}
        onPress={onPrimary}
      >
        {isWorking && workingLabel ? workingLabel : primaryLabel}
      </Button>
      <Button
        size={compact ? 'sm' : undefined}
        variant="flat"
        color={compact ? undefined : 'danger'}
        onPress={onCancel}
      >
        {cancelLabel}
      </Button>
    </div>
  )
}

interface ReleaseNotesCardProps {
  isChecking: boolean
  releaseNotes: string
  statusText: string
}

function ReleaseNotesCard({ isChecking, releaseNotes, statusText }: ReleaseNotesCardProps) {
  const renderedReleaseNotes = useMemo(
    () => normalizeReleaseNotes(releaseNotes || statusText),
    [releaseNotes, statusText],
  )

  return (
    <Card className="mx-20 mt-2.5 h-[calc(100vh-150px)] overscroll-auto">
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
              remarkPlugins={[remarkGfm]}
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
                  return <li className="list-inside list-disc" children={children} />
                },
              }}
            >
              {renderedReleaseNotes}
            </ReactMarkdown>
          </div>
        )}
      </CardBody>
    </Card>
  )
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
        if (event.result) {
          setResult(event.result)
        }
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

  const isReadyToRestart = statusText === t('updater.ready_restart')
  const updatePrimaryAction = getUpdatePrimaryAction(result, isReadyToRestart)

  const primaryAction = async () => {
    switch (updatePrimaryAction) {
      case 'check':
        await refresh()
        return
      case 'open-release-page':
        await openReleasePage()
        return
      case 'install':
        setIsWorking(true)
        await install()
        return
      case 'download':
        setIsWorking(true)
        await download()
        return
      case 'none':
        return
    }
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

  const primaryLabel =
    updatePrimaryAction === 'check'
      ? t('updater.check')
      : updatePrimaryAction === 'open-release-page'
        ? t('updater.go_to_download')
        : updatePrimaryAction === 'install'
          ? t('updater.restart')
          : t('updater.update')
  const primaryDisabled = isChecking || isWorking || updatePrimaryAction === 'none'

  if (isNotification) {
    return (
      <div className={`h-screen bg-background p-4 select-none ${LINUX_WINDOW_FRAME_CLASS}`}>
        <Toaster />
        <UpdaterHeader
          title={t('updater.title')}
          subtitle={
            result?.version
              ? t('updater.version_available', { version: result.version })
              : statusText
          }
          compact
        />
        <p className="mt-4 h-14 text-sm text-default-600 line-clamp-3">
          {statusText || result?.releaseName || t('updater.available')}
        </p>
        <UpdaterProgress progress={progress} progressLabel={t('updater.progress')} compact />
        <UpdaterActions
          primaryLabel={primaryLabel}
          cancelLabel={t('updater.cancel')}
          isWorking={isWorking}
          primaryDisabled={primaryDisabled}
          onPrimary={primaryAction}
          onCancel={() => appWindow.close()}
          compact
        />
      </div>
    )
  }

  return (
    <div className={`h-screen bg-background ${LINUX_WINDOW_FRAME_CLASS}`}>
      <Toaster />
      <UpdaterHeader title={t('updater.title')} />
      <ReleaseNotesCard
        isChecking={isChecking}
        releaseNotes={releaseNotes}
        statusText={statusText}
      />
      <UpdaterProgress
        progress={progress}
        progressLabel={t('updater.progress')}
        isWorking={isWorking}
      />
      <UpdaterActions
        primaryLabel={primaryLabel}
        cancelLabel={t('updater.cancel')}
        isWorking={isWorking}
        isChecking={isChecking}
        primaryDisabled={primaryDisabled}
        onPrimary={primaryAction}
        onCancel={() => appWindow.close()}
        workingLabel={statusText || t('updater.downloading')}
      />
    </div>
  )
}
