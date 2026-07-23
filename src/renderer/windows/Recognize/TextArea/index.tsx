import { Card, CardBody, CardFooter, Button, Skeleton, ButtonGroup, Tooltip } from '@heroui/react'
import { sendNotification } from '@/renderer/lib/electron/notification'
import { writeClipboardText } from '@/renderer/lib/electron/clipboard'
import { atom, useAtom, useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { CgSpaceBetween } from 'react-icons/cg'
import { MdContentCopy } from 'react-icons/md'
import { MdSmartButton } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

import {
  getServiceName,
  getServiceSouceType,
  ServiceSourceType,
} from '@/renderer/lib/service/service_instance'
import { currentServiceInstanceKeyAtom, languageAtom, recognizeFlagAtom } from '../ControlArea'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import type { ServiceInstanceConfigMap } from '@/renderer/lib/service/serviceConfig'
import * as builtinServices from '@/renderer/providers/recognize'
import type { RecognizeProvider } from '@/renderer/providers/recognize'
import { useConfig } from '../../../hooks'
import { base64Atom } from '../ImageArea'
import { pluginListAtom } from '..'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'

export const textAtom = atom('')
let recognizeId = ''
const RECOGNIZE_TIMEOUT_MS = 30000

interface TextAreaProps {
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

const builtinServiceMap: Record<string, RecognizeProvider> = builtinServices

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), RECOGNIZE_TIMEOUT_MS)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout)
    }
  })
}

function normalizeRecognizedText(value: unknown, deleteNewline: boolean) {
  let text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (deleteNewline) {
    text = text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
  }
  return text
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.toString() : String(error)
}

export default function TextArea(props: TextAreaProps) {
  const { serviceInstanceConfigMap } = props
  const [autoCopy] = useConfig('recognize_auto_copy', false)
  const [deleteNewline] = useConfig('recognize_delete_newline', false)
  const [hideWindow] = useConfig('recognize_hide_window', false)
  const recognizeFlag = useAtomValue(recognizeFlagAtom)
  const currentServiceInstanceKey = useAtomValue(currentServiceInstanceKeyAtom)
  const language = useAtomValue(languageAtom)
  const base64 = useAtomValue(base64Atom)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useAtom(textAtom)
  const [error, setError] = useState('')
  const pluginList = useAtomValue(pluginListAtom)
  const { t } = useTranslation()

  useEffect(() => {
    setText('')
    setError('')
    if (
      base64 !== '' &&
      currentServiceInstanceKey &&
      autoCopy !== null &&
      deleteNewline !== null &&
      hideWindow !== null
    ) {
      setLoading(true)
      if (getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN) {
        if (language in pluginList[getServiceName(currentServiceInstanceKey)].language) {
          const id = crypto.randomUUID()
          recognizeId = id
          const pluginConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {}

          invoke_plugin('recognize', getServiceName(currentServiceInstanceKey)).then(
            ([func, utils]) => {
              withTimeout(
                func(
                  base64,
                  pluginList[getServiceName(currentServiceInstanceKey)].language[language],
                  {
                    config: pluginConfig,
                    utils,
                  },
                ),
                t('errors.recognize_timeout'),
              ).then(
                (value) => {
                  if (recognizeId !== id) return
                  const v = normalizeRecognizedText(value, deleteNewline)
                  setText(v)
                  setLoading(false)
                  if (autoCopy) {
                    writeClipboardText(v).then(() => {
                      if (hideWindow) {
                        sendNotification({
                          title: t('common.write_clipboard'),
                          body: v,
                        })
                      }
                    })
                  }
                },
                (e: unknown) => {
                  if (recognizeId !== id) return
                  reportRuntimeError(e, {
                    source: 'recognize.plugin',
                    logMessage: 'Recognition plugin rejected.',
                    toastId: `recognize.plugin:${currentServiceInstanceKey}`,
                    context: {
                      service: currentServiceInstanceKey,
                      language,
                    },
                  })
                  setError(toErrorMessage(e))
                  setLoading(false)
                },
              )
            },
            (e: unknown) => {
              if (recognizeId !== id) return
              reportRuntimeError(e, {
                source: 'recognize.plugin.load',
                logMessage: 'Recognition plugin failed to load.',
                toastId: `recognize.plugin.load:${currentServiceInstanceKey}`,
                context: {
                  service: currentServiceInstanceKey,
                  language,
                },
              })
              setError(toErrorMessage(e))
              setLoading(false)
            },
          )
        } else {
          setError(t('errors.language_not_supported'))
          setLoading(false)
        }
      } else {
        if (language in builtinServiceMap[getServiceName(currentServiceInstanceKey)].Language) {
          const id = crypto.randomUUID()
          recognizeId = id
          withTimeout(
            builtinServiceMap[getServiceName(currentServiceInstanceKey)].recognize(
              base64,
              builtinServiceMap[getServiceName(currentServiceInstanceKey)].Language[language],
            ),
            t('errors.recognize_timeout'),
          ).then(
            (value) => {
              if (recognizeId !== id) return
              const v = normalizeRecognizedText(value, deleteNewline)
              setText(v)
              setLoading(false)
              if (autoCopy) {
                writeClipboardText(v).then(() => {
                  if (hideWindow) {
                    sendNotification({
                      title: t('common.write_clipboard'),
                      body: v,
                    })
                  }
                })
              }
            },
            (e: unknown) => {
              if (recognizeId !== id) return
              reportRuntimeError(e, {
                source: 'recognize.builtin',
                logMessage: 'Recognition provider rejected.',
                toastId: `recognize.builtin:${currentServiceInstanceKey}`,
                context: {
                  service: currentServiceInstanceKey,
                  language,
                },
              })
              setError(toErrorMessage(e))
              setLoading(false)
            },
          )
        } else {
          setError(t('errors.language_not_supported'))
          setLoading(false)
        }
      }
    }
  }, [
    base64,
    currentServiceInstanceKey,
    language,
    recognizeFlag,
    autoCopy,
    deleteNewline,
    hideWindow,
    pluginList,
    serviceInstanceConfigMap,
    setText,
    t,
  ])

  return (
    <Card shadow="none" className="bg-content1 h-full ml-1.5 mr-3" radius="lg">
      <CardBody className="bg-content1 p-0 h-full">
        {loading ? (
          <div className="space-y-3 m-3">
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
          <>
            {text && (
              <textarea
                value={text}
                className="bg-content1 h-full m-3 mb-0 resize-none focus:outline-none"
                onChange={(e) => {
                  setText(e.target.value)
                }}
              />
            )}
            {error && (
              <textarea
                value={error}
                readOnly
                className="m-3 mb-0 h-full resize-none bg-content1 text-danger focus:outline-none"
              />
            )}
          </>
        )}
      </CardBody>
      <CardFooter className="bg-content1 flex justify-start px-3">
        <ButtonGroup>
          <Tooltip content={t('recognize.copy_text')}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => {
                writeClipboardText(text)
              }}
            >
              <MdContentCopy className="text-[16px]" />
            </Button>
          </Tooltip>
          <Tooltip content={t('recognize.delete_newline')}>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => {
                setText(text.replace(/-\s+/g, '').replace(/\s+/g, ' '))
              }}
            >
              <MdSmartButton className="text-[16px]" />
            </Button>
          </Tooltip>
          <Tooltip content={t('recognize.delete_space')}>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => {
                setText(text.replaceAll(' ', ''))
              }}
            >
              <CgSpaceBetween className="text-[16px]" />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </CardFooter>
    </Card>
  )
}
