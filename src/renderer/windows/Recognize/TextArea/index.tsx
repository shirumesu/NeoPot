import { Card, CardBody, CardFooter, Button, Skeleton, ButtonGroup, Tooltip } from '@heroui/react'
import { sendNotification } from '@/renderer/lib/electron/compat/notification'
import { writeText } from '@/renderer/lib/electron/compat/clipboard'
import { atom, useAtom, useAtomValue } from 'jotai'
import React, { useEffect, useState } from 'react'
import { CgSpaceBetween } from 'react-icons/cg'
import { MdContentCopy } from 'react-icons/md'
import { MdSmartButton } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { nanoid } from 'nanoid'

import {
  getServiceName,
  getServiceSouceType,
  ServiceSourceType,
} from '@/renderer/lib/service/service_instance'
import { currentServiceInstanceKeyAtom, languageAtom, recognizeFlagAtom } from '../ControlArea'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import * as builtinServices from '@/renderer/providers/recognize'
import { useConfig } from '../../../hooks'
import { base64Atom } from '../ImageArea'
import { pluginListAtom } from '..'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'

export const textAtom = atom('')
let recognizeId = ''
const RECOGNIZE_TIMEOUT_MS = 30000
const builtinServiceMap = builtinServices as Record<string, any>

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

export default function TextArea(props: any) {
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
          const id = nanoid()
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
                (v: any) => {
                  if (recognizeId !== id) return
                  v = v.trim()
                  if (deleteNewline) {
                    v = v.replace(/-\s+/g, '').replace(/\s+/g, ' ')
                  }
                  setText(v)
                  setLoading(false)
                  if (autoCopy) {
                    writeText(v).then(() => {
                      if (hideWindow) {
                        sendNotification({
                          title: t('common.write_clipboard'),
                          body: v,
                        })
                      }
                    })
                  }
                },
                (e: any) => {
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
                  setError(e.toString())
                  setLoading(false)
                },
              )
            },
            (e: any) => {
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
              setError(e.toString())
              setLoading(false)
            },
          )
        } else {
          setError(t('errors.language_not_supported'))
          setLoading(false)
        }
      } else {
        const instanceConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {}
        if (language in builtinServiceMap[getServiceName(currentServiceInstanceKey)].Language) {
          const id = nanoid()
          recognizeId = id
          withTimeout(
            builtinServiceMap[getServiceName(currentServiceInstanceKey)].recognize(
              base64,
              builtinServiceMap[getServiceName(currentServiceInstanceKey)].Language[language],
              {
                config: instanceConfig,
              },
            ),
            t('errors.recognize_timeout'),
          ).then(
            (v: any) => {
              if (recognizeId !== id) return
              v = v.trim()
              if (deleteNewline) {
                v = v.replace(/-\s+/g, '').replace(/\s+/g, ' ')
              }
              setText(v)
              setLoading(false)
              if (autoCopy) {
                writeText(v).then(() => {
                  if (hideWindow) {
                    sendNotification({
                      title: t('common.write_clipboard'),
                      body: v,
                    })
                  }
                })
              }
            },
            (e: any) => {
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
              setError(e.toString())
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
                className="bg-content1 h-full m-3 mb-0 resize-none focus:outline-none text-red-500"
                onChange={(e) => {
                  setText(e.target.value)
                }}
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
                writeText(text)
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
