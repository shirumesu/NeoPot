import { Button, Chip, Code, Divider, Progress, Skeleton } from '@heroui/react'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import remarkGfm from 'remark-gfm'

import { appVersion } from '@/renderer/lib/config/env'
import { SafeRichText } from '@/renderer/components/SafeRichText'
import { looksLikeHtmlReleaseNotes } from './releaseNotes'
import type { UpdaterController, UpdaterPhase } from './useUpdaterController'
import { formatBytes, formatBytesPerSecond, getProgressPercent } from './formatProgress'
import { getUpdatePrimaryLabel } from './updateActions'

interface UpdaterPanelProps {
  controller: UpdaterController
  onCancel: () => void
}

function phaseLabelKey(phase: UpdaterPhase): string | null {
  switch (phase) {
    case 'checking':
      return 'updater.checking'
    case 'downloading':
      return 'updater.downloading'
    case 'ready-restart':
      return 'updater.ready_restart'
    case 'installing':
      return 'updater.installing'
    case 'idle':
      return null
  }
}

function statusColor(resultStatus: string | undefined, phase: UpdaterPhase) {
  if (phase === 'checking' || phase === 'downloading' || phase === 'installing') {
    return 'primary'
  }

  if (phase === 'ready-restart') {
    return 'success'
  }

  if (resultStatus === 'available') {
    return 'success'
  }

  if (resultStatus === 'not-available') {
    return 'default'
  }

  if (resultStatus === 'unsupported') {
    return 'warning'
  }

  if (resultStatus === 'error') {
    return 'danger'
  }

  return 'default'
}

function MarkdownPreview({ value }: { value: string }) {
  if (looksLikeHtmlReleaseNotes(value)) {
    return (
      <div className="markdown-body select-text text-sm leading-6 text-foreground/85">
        <SafeRichText value={value} />
      </div>
    )
  }

  return (
    <div className="markdown-body select-text text-sm leading-6 text-foreground/85">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ node: _node, ...props }) => {
            const { children } = props
            return <Code size="sm">{children}</Code>
          },
          h1: ({ node: _node, ...props }) => (
            <h1 className="mb-3 text-xl font-semibold leading-7" {...props} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2
              className="mb-2 mt-4 border-b border-default-200 pb-2 text-lg font-semibold leading-6 first:mt-0"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold leading-6" {...props} />
          ),
          p: ({ node: _node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          ul: ({ node: _node, ...props }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
          ),
          li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
          a: ({ node: _node, ...props }) => (
            <a className="text-primary underline underline-offset-2" {...props} />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

function ReleaseNotesPreview({ isChecking, value }: { isChecking: boolean; value: string }) {
  if (isChecking && !value) {
    return (
      <div className="space-y-3">
        <Skeleton className="w-3/5 rounded-lg">
          <div className="h-3 w-3/5 rounded-lg bg-default-200" />
        </Skeleton>
        <Skeleton className="w-4/5 rounded-lg">
          <div className="h-3 w-4/5 rounded-lg bg-default-200" />
        </Skeleton>
        <Skeleton className="w-2/5 rounded-lg">
          <div className="h-3 w-2/5 rounded-lg bg-default-300" />
        </Skeleton>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-default-200 bg-content1 p-4">
      <MarkdownPreview value={value} />
    </div>
  )
}

function formatProgressSummary(controller: UpdaterController) {
  const progress = controller.progress
  const transferred = formatBytes(progress?.transferred)
  const total = formatBytes(progress?.total)
  const speed = formatBytesPerSecond(progress?.bytesPerSecond)
  const amount = transferred && total ? `${transferred} / ${total}` : transferred || total

  return [amount, speed].filter(Boolean).join('  |  ')
}

function UpdateSummary({
  controller,
  title,
  description,
}: {
  controller: UpdaterController
  title: string
  description: string
}) {
  const { t } = useTranslation()
  const progress = controller.progress
  const percent = getProgressPercent(progress)
  const progressSummary = formatProgressSummary(controller)
  const showProgress = Boolean(progress) || controller.isChecking || controller.isWorking
  const currentVersion = t('updater.current_version', { version: appVersion })

  return (
    <section className="shrink-0 rounded-lg border border-default-200 bg-content1 px-4 py-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              color={statusColor(controller.result?.status, controller.phase)}
              variant="flat"
              className="max-w-full"
            >
              <span className="truncate">{title}</span>
            </Chip>
            <span className="min-w-0 truncate text-xs text-default-500">{currentVersion}</span>
          </div>
          <h1 className="break-words text-xl font-semibold leading-7">{title}</h1>
          <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-default-600">
            {description}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-start justify-start gap-1 md:items-end md:text-right">
          <span className="text-xs font-medium text-default-500">{t('updater.progress')}</span>
          <span className="max-w-full truncate text-sm font-medium text-primary">
            {progressSummary || currentVersion}
          </span>
        </div>
      </div>

      {showProgress && (
        <Progress
          aria-label={t('updater.progress')}
          className="mt-3"
          value={percent}
          isIndeterminate={percent === undefined}
          showValueLabel={percent !== undefined}
          size="sm"
        />
      )}
    </section>
  )
}

function getStatusTitle(controller: UpdaterController, t: ReturnType<typeof useTranslation>['t']) {
  const phaseKey = phaseLabelKey(controller.phase)
  if (phaseKey) {
    return t(phaseKey)
  }

  if (controller.result?.status === 'available') {
    return controller.result.version
      ? t('updater.version_available', { version: controller.result.version })
      : t('updater.available')
  }

  if (controller.result?.status === 'not-available') {
    return t('updater.latest_plain')
  }

  if (controller.result?.status === 'unsupported') {
    return t('updater.unsupported_title')
  }

  if (controller.result?.status === 'error') {
    return t('updater.error')
  }

  return t('updater.title')
}

function getStatusDescription(
  controller: UpdaterController,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (controller.message) {
    return controller.message
  }

  if (controller.phase === 'checking') {
    return t('updater.checking_detail')
  }

  if (controller.phase === 'downloading') {
    return t('updater.downloading_detail')
  }

  if (controller.phase === 'ready-restart') {
    return t('updater.ready_restart_detail')
  }

  if (controller.phase === 'installing') {
    return t('updater.installing_detail')
  }

  if (controller.result?.status === 'available') {
    return controller.result.mode === 'manual-download'
      ? t('updater.manual_download_detail')
      : t('updater.available_detail')
  }

  if (controller.result?.status === 'not-available') {
    return t('updater.latest_detail', {
      version: controller.result.version || controller.result.currentVersion || appVersion,
    })
  }

  if (controller.result?.status === 'unsupported') {
    return t('updater.unsupported_detail')
  }

  if (controller.result?.status === 'error') {
    return controller.result.message || t('updater.error_detail')
  }

  return t('updater.checking_detail')
}

function getReleaseNotes(controller: UpdaterController, t: ReturnType<typeof useTranslation>['t']) {
  if (controller.result?.releaseNotes) {
    return controller.result.releaseNotes
  }

  if (controller.result?.status === 'not-available') {
    return t('updater.latest')
  }

  if (controller.result?.status === 'unsupported') {
    return t('updater.unsupported')
  }

  if (controller.result?.status === 'error') {
    return controller.result.message || t('updater.error')
  }

  if (controller.result?.status === 'available') {
    return t('updater.no_release_notes')
  }

  return ''
}

export function UpdaterPanel({ controller, onCancel }: UpdaterPanelProps) {
  const { t } = useTranslation()
  const releaseNotes = getReleaseNotes(controller, t)
  const title = getStatusTitle(controller, t)
  const description = getStatusDescription(controller, t)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <UpdateSummary controller={controller} title={title} description={description} />

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('updater.release_notes')}</h2>
          {controller.result?.releaseName && (
            <span className="ml-3 min-w-0 truncate text-xs text-default-500">
              {controller.result.releaseName}
            </span>
          )}
        </div>
        <ReleaseNotesPreview isChecking={controller.isChecking} value={releaseNotes} />
      </section>

      <Divider />

      <div className="grid shrink-0 grid-cols-2 gap-3">
        <Button
          color="primary"
          isLoading={controller.isChecking || controller.isWorking}
          isDisabled={controller.primaryDisabled}
          onPress={() => void controller.runPrimaryAction()}
        >
          {getUpdatePrimaryLabel(controller.primaryAction, t)}
        </Button>
        <Button variant="flat" onPress={onCancel}>
          {t('updater.cancel')}
        </Button>
      </div>
    </div>
  )
}
