import { Button, Chip, Code, Divider, Progress, Skeleton } from '@heroui/react'
import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import remarkGfm from 'remark-gfm'

import { appVersion } from '@/renderer/lib/config/env'
import { normalizeReleaseNotes } from './releaseNotes'
import type { UpdaterController, UpdaterPhase } from './useUpdaterController'
import { formatBytes, formatBytesPerSecond, getProgressPercent } from './formatProgress'

interface UpdaterPanelProps {
  controller: UpdaterController
  onCancel: () => void
  variant?: 'window' | 'modal'
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
  const renderedReleaseNotes = useMemo(() => normalizeReleaseNotes(value), [value])

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
        {renderedReleaseNotes}
      </ReactMarkdown>
    </div>
  )
}

function ReleaseNotesPreview({
  isChecking,
  value,
  compact,
}: {
  isChecking: boolean
  value: string
  compact: boolean
}) {
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
    <div
      className={`overflow-y-auto rounded-lg border border-default-200 bg-content1 p-4 ${
        compact ? 'max-h-[34vh]' : 'min-h-0 flex-1'
      }`}
    >
      <MarkdownPreview value={value} />
    </div>
  )
}

function ProgressDetails({ controller }: { controller: UpdaterController }) {
  const { t } = useTranslation()
  const progress = controller.progress
  const percent = getProgressPercent(progress)
  const transferred = formatBytes(progress?.transferred)
  const total = formatBytes(progress?.total)
  const speed = formatBytesPerSecond(progress?.bytesPerSecond)

  if (!progress && !controller.isWorking) {
    return null
  }

  return (
    <div className="space-y-2 rounded-lg border border-default-200 bg-content1 px-4 py-3">
      <Progress
        aria-label={t('updater.progress')}
        value={percent}
        isIndeterminate={percent === undefined}
        showValueLabel={percent !== undefined}
        size="sm"
      />
      <div className="grid grid-cols-1 gap-2 text-xs text-default-600 sm:grid-cols-3">
        <div>
          <div className="font-medium text-foreground">{t('updater.downloaded')}</div>
          <div>{transferred && total ? `${transferred} / ${total}` : transferred || '-'}</div>
        </div>
        <div>
          <div className="font-medium text-foreground">{t('updater.package_size')}</div>
          <div>{total || '-'}</div>
        </div>
        <div>
          <div className="font-medium text-foreground">{t('updater.download_speed')}</div>
          <div>{speed || '-'}</div>
        </div>
      </div>
    </div>
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

function primaryLabel(
  action: UpdaterController['primaryAction'],
  t: ReturnType<typeof useTranslation>['t'],
) {
  switch (action) {
    case 'check':
      return t('updater.check')
    case 'open-release-page':
      return t('updater.go_to_download')
    case 'install':
      return t('updater.restart')
    case 'download':
      return t('updater.update')
    case 'none':
      return t('updater.update')
  }
}

export function UpdaterPanel({ controller, onCancel, variant = 'window' }: UpdaterPanelProps) {
  const { t } = useTranslation()
  const compact = variant === 'modal'
  const releaseNotes = getReleaseNotes(controller, t)
  const title = getStatusTitle(controller, t)
  const description = getStatusDescription(controller, t)

  return (
    <div className={`flex min-h-0 flex-col gap-4 ${compact ? '' : 'h-full'}`}>
      <section className="rounded-lg border border-default-200 bg-content1 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                color={statusColor(controller.result?.status, controller.phase)}
                variant="flat"
              >
                {title}
              </Chip>
              <span className="text-xs text-default-500">
                {t('updater.current_version', { version: appVersion })}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-7">{title}</h1>
            <p className="mt-1 text-sm leading-5 text-default-600">{description}</p>
          </div>
        </div>
      </section>

      <ProgressDetails controller={controller} />

      <section className={`flex min-h-0 flex-col gap-2 ${compact ? '' : 'flex-1'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('updater.release_notes')}</h2>
          {controller.result?.releaseName && (
            <span className="truncate text-xs text-default-500">
              {controller.result.releaseName}
            </span>
          )}
        </div>
        <ReleaseNotesPreview
          isChecking={controller.isChecking}
          value={releaseNotes}
          compact={compact}
        />
      </section>

      <Divider />

      <div className="grid shrink-0 grid-cols-2 gap-3">
        <Button
          color="primary"
          isLoading={controller.isChecking || controller.isWorking}
          isDisabled={controller.primaryDisabled}
          onPress={() => void controller.runPrimaryAction()}
        >
          {primaryLabel(controller.primaryAction, t)}
        </Button>
        <Button variant="flat" onPress={onCancel}>
          {t('updater.cancel')}
        </Button>
      </div>
    </div>
  )
}
