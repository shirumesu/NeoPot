// @ts-nocheck
import { Code, Card, CardBody, Button, Progress, Skeleton } from '@heroui/react'
import { check } from '@/utils/electron_compat/updater'
import React, { useEffect, useState } from 'react'
import { getCurrentWebviewWindow } from '@/utils/electron_compat/webviewWindow'
import { relaunch } from '@/utils/electron_compat/process'
import toast, { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'

import { useToastStyle } from '../../hooks'
import { osType } from '../../utils/env'
const appWindow = getCurrentWebviewWindow()

export default function Updater() {
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [body, setBody] = useState('')
  const [update, setUpdate] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const { t } = useTranslation()
  const toastStyle = useToastStyle()

  useEffect(() => {
    if (appWindow.label === 'updater') {
      appWindow.show()
    }
    check().then(
      (update) => {
        if (update) {
          setUpdate(update)
          setBody(update.body || '')
        } else {
          setBody(t('updater.latest'))
        }
      },
      (e) => {
        setBody(e.toString())
        toast.error(e.toString(), { style: toastStyle })
      },
    )
  }, [])

  const install = () => {
    if (!update) {
      return
    }

    setIsUpdating(true)
    setDownloaded(0)
    setTotal(0)
    update
      .downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setTotal(event.data.contentLength || 0)
        }
        if (event.event === 'Progress') {
          setDownloaded((a) => a + event.data.chunkLength)
        }
      })
      .then(
        () => {
          toast.success(t('updater.installed'), {
            style: toastStyle,
            duration: 10000,
          })
          relaunch()
        },
        (e) => {
          toast.error(e.toString(), { style: toastStyle })
          setIsUpdating(false)
        },
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
          {body === '' ? (
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
                  code: ({ node, ...props }) => {
                    const { children } = props
                    return <Code size="sm">{children}</Code>
                  },
                  h2: ({ node, ...props }) => (
                    <b>
                      <h2 className="text-[24px]" {...props} />
                      <hr />
                      <br />
                    </b>
                  ),
                  h3: ({ node, ...props }) => (
                    <b>
                      <br />
                      <h3 className="text-[18px]" {...props} />
                      <br />
                    </b>
                  ),
                  li: ({ node, ...props }) => {
                    const { children } = props
                    return <li className="list-disc list-inside" children={children} />
                  },
                }}
              >
                {body}
              </ReactMarkdown>
            </div>
          )}
        </CardBody>
      </Card>
      {isUpdating && (
        <Progress
          aria-label="Downloading..."
          label={t('updater.progress')}
          value={total === 0 ? undefined : (downloaded / total) * 100}
          isIndeterminate={total === 0}
          classNames={{
            base: 'w-full px-[80px]',
            track: 'drop-shadow-md border border-default',
            indicator: 'bg-gradient-to-r from-pink-500 to-yellow-500',
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
          isLoading={isUpdating}
          isDisabled={isUpdating || !update}
          color="primary"
          onPress={install}
        >
          {isUpdating
            ? downloaded > total
              ? t('updater.installing')
              : t('updater.downloading')
            : t('updater.update')}
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
