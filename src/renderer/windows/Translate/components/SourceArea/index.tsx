import {
  Button,
  Card,
  CardBody,
  CardFooter,
  ButtonGroup,
  Chip,
  Tooltip,
  Spacer,
} from '@heroui/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { writeClipboardText } from '@/renderer/lib/electron/clipboard'
import { HiOutlineVolumeUp } from 'react-icons/hi'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { onAppEvent } from '@/renderer/lib/electron/events'
import { MdContentCopy } from 'react-icons/md'
import { MdSmartButton } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { HiTranslate } from 'react-icons/hi'
import { LuDelete } from 'react-icons/lu'
import { atom, useAtom, useSetAtom } from 'jotai'
import {
  getServiceName,
  getServiceSouceType,
  isValidServiceInstanceKey,
  ServiceSourceType,
} from '@/renderer/lib/service/service_instance'
import { useConfig, useSyncAtom, useTtsSpeak } from '../../../../hooks'
import type { ServiceInstanceConfigMap } from '@/renderer/lib/service/serviceConfig'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import { invokeCommand } from '@/renderer/lib/electron/command'
import * as recognizeServices from '@/renderer/providers/recognize'
import type { RecognizeProvider } from '@/renderer/providers/recognize'
import detect from '@/renderer/lib/language/lang_detect'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import {
  toTranslateWorkflowPayload,
  type SelectionCaptureFailureReason,
  type SelectionCaptureResult,
} from '@/shared/translateWorkflow'
const appWindow = getCurrentWindow()

export const sourceTextAtom = atom('')
export const detectLanguageAtom = atom('')
export const manualTranslateFlagAtom = atom('')

const DEFAULT_RECOGNIZE_SERVICE_LIST = ['local_model']
interface SourceAreaProps {
  pluginList: EnabledServicePluginList
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

interface SourceNotice {
  tone: 'warning' | 'danger'
  message: string
}

const selectionCaptureFailureKeys: Record<SelectionCaptureFailureReason, string> = {
  empty: 'translate.selection_capture.empty',
  'copy-helper-unavailable': 'translate.selection_capture.copy_helper_unavailable',
  'copy-command-failed': 'translate.selection_capture.copy_command_failed',
  'copy-timeout': 'translate.selection_capture.copy_timeout',
  'unsupported-platform': 'translate.selection_capture.unsupported_platform',
}

const recognizeServiceMap: Record<string, RecognizeProvider> = recognizeServices
function toResultText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.toString() : String(error)
}

function transformVarName(str: string) {
  let str2 = str

  // snake_case to SNAKE_CASE
  if (/_[a-z]/.test(str2)) {
    str2 = str2
      .split('_')
      .map((it: string) => it.toLocaleUpperCase())
      .join('_')
  }
  if (str2 !== str) {
    return str2
  }

  // SNAKE_CASE to kebab-case
  if (/^[A-Z]+(_[A-Z]+)*$/.test(str2)) {
    str2 = str2
      .split('_')
      .map((it: string) => it.toLocaleLowerCase())
      .join('-')
  }
  if (str2 !== str) {
    return str2
  }

  // kebab-case to dot.notation
  if (/-/.test(str2)) {
    str2 = str2
      .split('-')
      .map((it: string) => it.toLocaleLowerCase())
      .join('.')
  }
  if (str2 !== str) {
    return str2
  }

  // dot.notation to space separated
  if (/\.[a-z]/.test(str2)) {
    str2 = str2.replaceAll(/(\.)([a-z])/g, (_: string, _2: string, it: string) => ' ' + it)
  }
  if (str2 !== str) {
    return str2
  }

  // space separated to Title Case
  if (/\s[a-z]/.test(str2)) {
    str2 = str2.replaceAll(/\s([a-z])/g, (_: string, it: string) => ' ' + it.toLocaleUpperCase())
    str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // Title Case to CamelCase
  if (/\s[A-Z]/.test(str2)) {
    str2 = str2.replaceAll(/\s([A-Z])/g, (_: string, it: string) => it)
    str2 = str2.substring(0, 1).toLocaleLowerCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // CamelCase to PascalCase
  if (/^[a-z]+[A-Z]+/.test(str2)) {
    str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // PascalCase to snake_case
  if (/[^\s][A-Z]/.test(str2)) {
    str2 = str2.replaceAll(/[A-Z]/g, (it: string, offset: number) => {
      return (offset == 0 ? '' : '_') + it.toLocaleLowerCase()
    })
  }

  return str2
}

export default function SourceArea(props: SourceAreaProps) {
  const { pluginList, serviceInstanceConfigMap } = props
  const [appFontSize] = useConfig('app_font_size', 16)
  const [sourceText, setSourceText, syncSourceText] = useSyncAtom(sourceTextAtom)
  const [detectLanguage, setDetectLanguage] = useAtom(detectLanguageAtom)
  const setManualTranslateFlag = useSetAtom(manualTranslateFlagAtom)
  const [incrementalTranslate] = useConfig('incremental_translate', false)
  const [dynamicTranslate] = useConfig('dynamic_translate', false)
  const [deleteNewline] = useConfig('translate_delete_newline', false)
  const [recognizeLanguage] = useConfig<string>('recognize_language', 'auto')
  const [recognizeServiceList] = useConfig<string[]>(
    'recognize_service_list',
    DEFAULT_RECOGNIZE_SERVICE_LIST,
  )
  const [hideWindow] = useConfig('translate_hide_window', false)
  const [hideSource] = useConfig('hide_source', false)
  const [sourceNotice, setSourceNotice] = useState<SourceNotice | null>(null)
  const [windowType, setWindowType] = useState('[SELECTION_TRANSLATE]')
  const { t } = useTranslation()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const initialTextLoadedRef = useRef(false)
  const workflowTextVersionRef = useRef(0)
  const sourceTextChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { serviceInstanceKey: ttsServiceInstanceKey, speak: speakText } = useTtsSpeak({
    pluginList,
    serviceInstanceConfigMap,
  })

  const reportSourceAreaError = useCallback((error: unknown, source: string) => {
    reportRuntimeError(error, {
      source,
      logMessage: 'Translate source operation failed.',
      toastId: source,
      context: {
        window: 'translate',
      },
    })
  }, [])

  const detect_language = useCallback(
    async (text: string) => {
      setDetectLanguage(String(await detect(text)))
    },
    [setDetectLanguage],
  )

  const normalizeInputText = useCallback(
    (text: string) => {
      const trimmedText = text.trim()
      if (deleteNewline) {
        return trimmedText.replace(/-\s+/g, '').replace(/\s+/g, ' ')
      }

      return trimmedText
    },
    [deleteNewline],
  )

  const commitSourceText = useCallback(
    async (newText: string) => {
      const nextText = incrementalTranslate
        ? [sourceText.trim(), newText].filter(Boolean).join('\n')
        : newText

      setSourceNotice(null)
      setSourceText(nextText)
      await detect_language(nextText)
      syncSourceText(nextText)
    },
    [detect_language, incrementalTranslate, setSourceText, sourceText, syncSourceText],
  )

  const showWorkflowWindow = useCallback(
    (forceShow: boolean) => {
      if (hideWindow && !forceShow) {
        appWindow.hide()
        return
      }

      appWindow.show()
      appWindow.setFocus()
    },
    [hideWindow],
  )

  const showSelectionCaptureNotice = useCallback(
    (capture: SelectionCaptureResult) => {
      if (capture.ok) {
        return
      }

      showWorkflowWindow(true)
      setWindowType('[SELECTION_TRANSLATE]')
      setDetectLanguage('')
      setSourceNotice({
        tone: capture.reason === 'empty' ? 'warning' : 'danger',
        message: t(selectionCaptureFailureKeys[capture.reason]),
      })
      setSourceText('', true)
      syncSourceText('')
    },
    [setDetectLanguage, setSourceText, showWorkflowWindow, syncSourceText, t],
  )

  const handleNewText = useCallback(
    async (payload: unknown) => {
      const workflow = toTranslateWorkflowPayload(payload)
      setDetectLanguage('')
      if (workflow.kind === 'selection') {
        setWindowType('[SELECTION_TRANSLATE]')
        if (!workflow.capture.ok) {
          showSelectionCaptureNotice(workflow.capture)
          return
        }
        showWorkflowWindow(false)
        await commitSourceText(normalizeInputText(workflow.capture.text))
      } else if (workflow.kind === 'text') {
        const text = workflow.text.trim()
        showWorkflowWindow(false)
        if (text === '') {
          setWindowType('[SELECTION_TRANSLATE]')
          setSourceNotice(null)
          setSourceText('', true)
          syncSourceText('')
          return
        }
        setWindowType('[SELECTION_TRANSLATE]')
        await commitSourceText(normalizeInputText(text))
      } else if (workflow.kind === 'input') {
        showWorkflowWindow(true)
        setWindowType('[INPUT_TRANSLATE]')
        setSourceNotice(null)
        setSourceText('', true)
      } else if (workflow.kind === 'image') {
        showWorkflowWindow(false)
        setWindowType('[IMAGE_TRANSLATE]')
        setSourceNotice(null)
        if (
          recognizeServiceList === null ||
          recognizeLanguage === null ||
          recognizeServiceList.length === 0
        ) {
          setSourceText(t('errors.recognize_service_not_configured'))
          return
        }
        const base64 = String(await invokeCommand('get_base64'))
        const serviceInstanceKey = recognizeServiceList[0]
        if (!isValidServiceInstanceKey(serviceInstanceKey)) {
          setSourceText(t('errors.recognize_service_not_configured'))
          return
        }
        const serviceName = getServiceName(serviceInstanceKey)
        if (getServiceSouceType(serviceInstanceKey) === ServiceSourceType.PLUGIN) {
          const pluginInfo = pluginList['recognize'][serviceName]
          if (!pluginInfo?.language) {
            setSourceText(t('errors.recognize_service_not_configured'))
            return
          }
          if (recognizeLanguage in pluginInfo.language) {
            const pluginConfig = serviceInstanceConfigMap[serviceInstanceKey]

            const [func, utils] = await invoke_plugin('recognize', serviceName)
            func(base64, pluginInfo.language[recognizeLanguage], {
              config: pluginConfig,
              utils,
            }).then(
              (value) => {
                void commitSourceText(normalizeInputText(toResultText(value)))
              },
              (e: unknown) => {
                reportRuntimeError(e, {
                  source: 'translate.image_recognize.plugin',
                  logMessage: 'Image translation OCR plugin failed.',
                  toastId: `translate.image_recognize.plugin:${serviceName}`,
                  context: {
                    service: serviceInstanceKey,
                    language: recognizeLanguage,
                  },
                })
                setSourceText(toErrorMessage(e))
              },
            )
          } else {
            setSourceText(t('errors.language_not_supported'))
          }
        } else {
          const recognizeService = recognizeServiceMap[serviceName]
          if (!recognizeService) {
            setSourceText(t('errors.recognize_service_not_configured'))
            return
          }
          if (recognizeLanguage in recognizeService.Language) {
            recognizeService.recognize(base64, recognizeService.Language[recognizeLanguage]).then(
              (value) => {
                void commitSourceText(normalizeInputText(toResultText(value)))
              },
              (e: unknown) => {
                reportRuntimeError(e, {
                  source: 'translate.image_recognize.builtin',
                  logMessage: 'Image translation OCR provider failed.',
                  toastId: `translate.image_recognize.builtin:${serviceName}`,
                  context: {
                    service: serviceInstanceKey,
                    language: recognizeLanguage,
                  },
                })
                setSourceText(toErrorMessage(e))
              },
            )
          } else {
            setSourceText(t('errors.language_not_supported'))
          }
        }
      }
    },
    [
      commitSourceText,
      normalizeInputText,
      pluginList,
      recognizeLanguage,
      recognizeServiceList,
      serviceInstanceConfigMap,
      setDetectLanguage,
      setSourceText,
      showSelectionCaptureNotice,
      showWorkflowWindow,
      syncSourceText,
      t,
    ],
  )

  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      detect_language(sourceText).then(() => {
        syncSourceText()
      })
    }
  }

  const handleNewTextRef = useRef(handleNewText)

  useEffect(() => {
    handleNewTextRef.current = handleNewText
  }, [handleNewText])

  const handleSpeak = async () => {
    if (!ttsServiceInstanceKey) {
      throw new Error(t('translate.tts_not_configured'))
    }
    let detected = detectLanguage
    if (detected === '') {
      detected = String(await detect(sourceText))
      setDetectLanguage(detected)
    }
    await speakText(sourceText, detected)
  }

  useEffect(() => {
    const removeListener = onAppEvent('new_text', (payload) => {
      appWindow.setFocus()
      workflowTextVersionRef.current += 1
      void handleNewTextRef.current(payload).catch((error) => {
        reportSourceAreaError(error, 'translate.new_text')
      })
    })
    void window.neoPot.app.rendererReady()

    return removeListener
  }, [reportSourceAreaError])

  useEffect(() => {
    return () => {
      if (sourceTextChangeTimerRef.current) {
        clearTimeout(sourceTextChangeTimerRef.current)
        sourceTextChangeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (initialTextLoadedRef.current) {
      return
    }
    if (
      deleteNewline !== null &&
      incrementalTranslate !== null &&
      recognizeLanguage !== null &&
      recognizeServiceList !== null &&
      hideWindow !== null
    ) {
      initialTextLoadedRef.current = true
      const requestVersion = workflowTextVersionRef.current
      invokeCommand('get_text').then((v) => {
        if (workflowTextVersionRef.current !== requestVersion) {
          return
        }
        void handleNewText(v).catch((error) => {
          reportSourceAreaError(error, 'translate.initial_text')
        })
      })
    }
  }, [
    deleteNewline,
    incrementalTranslate,
    recognizeLanguage,
    recognizeServiceList,
    hideWindow,
    handleNewText,
    reportSourceAreaError,
  ])

  useEffect(() => {
    if (!textAreaRef.current) {
      return
    }
    textAreaRef.current.style.height = '50px'
    textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px'
  }, [sourceText])

  const changeSourceText = useCallback(
    async (text: string) => {
      setDetectLanguage('')
      setSourceNotice(null)
      await setSourceText(text)
      if (dynamicTranslate) {
        if (sourceTextChangeTimerRef.current) {
          clearTimeout(sourceTextChangeTimerRef.current)
        }
        sourceTextChangeTimerRef.current = setTimeout(() => {
          detect_language(text).then(() => {
            syncSourceText()
          })
          sourceTextChangeTimerRef.current = null
        }, 1000)
      }
    },
    [detect_language, dynamicTranslate, setDetectLanguage, setSourceText, syncSourceText],
  )

  useEffect(() => {
    const element = textAreaRef.current
    if (!element) {
      return
    }

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === 'KeyU') {
        const originText = element.value
        const selectionStart = element.selectionStart
        const selectionEnd = element.selectionEnd
        const selectionText = originText.substring(selectionStart, selectionEnd)

        const convertedText = transformVarName(selectionText)
        const targetText =
          originText.substring(0, selectionStart) +
          convertedText +
          originText.substring(selectionEnd)

        await changeSourceText(targetText)
        element.selectionStart = selectionStart
        element.selectionEnd = selectionStart + convertedText.length
      }
    }

    element.addEventListener('keydown', onKeyDown)
    return () => element.removeEventListener('keydown', onKeyDown)
  }, [changeSourceText])

  return (
    <div
      className={
        hideSource && windowType !== '[INPUT_TRANSLATE]' && !sourceNotice ? 'hidden' : undefined
      }
    >
      <Card shadow="none" className="bg-content1 rounded-[10px] mt-px pb-0">
        <CardBody className="bg-content1 p-3 pb-0 max-h-[40vh] overflow-y-auto">
          {sourceNotice && (
            <div
              className={`mb-2 rounded-small border px-3 py-2 text-sm ${
                sourceNotice.tone === 'danger'
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : 'border-warning/30 bg-warning/10 text-warning-700'
              }`}
            >
              {sourceNotice.message}
            </div>
          )}
          <textarea
            autoFocus
            ref={textAreaRef}
            className="h-full resize-none bg-content1 outline-none"
            style={{ fontSize: appFontSize ?? 16 }}
            value={sourceText}
            onKeyDown={keyDown}
            onChange={(e) => {
              const v = e.target.value
              changeSourceText(v)
            }}
          />
        </CardBody>

        <CardFooter className="bg-content1 rounded-none rounded-b-[10px] flex justify-between px-3 p-1.25">
          <div className="flex justify-start">
            <ButtonGroup className="mr-1.25">
              <Tooltip content={t('translate.speak')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => {
                    handleSpeak().catch((e) => {
                      reportRuntimeError(e, {
                        source: 'translate.source.tts',
                        logMessage: 'Source text TTS failed.',
                        toastId: 'translate.source.tts',
                        context: {
                          service: ttsServiceInstanceKey ?? 'none',
                          detectedLanguage: detectLanguage,
                        },
                      })
                    })
                  }}
                >
                  <HiOutlineVolumeUp className="text-[16px]" />
                </Button>
              </Tooltip>
              <Tooltip content={t('translate.copy')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => {
                    writeClipboardText(sourceText)
                  }}
                >
                  <MdContentCopy className="text-[16px]" />
                </Button>
              </Tooltip>
              <Tooltip content={t('translate.delete_newline')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => {
                    const newText = sourceText.replace(/-\s+/g, '').replace(/\s+/g, ' ')
                    setSourceText(newText)
                    detect_language(newText).then(() => {
                      syncSourceText()
                    })
                  }}
                >
                  <MdSmartButton className="text-[16px]" />
                </Button>
              </Tooltip>
              <Tooltip content={t('common.clear')}>
                <Button
                  variant="light"
                  size="sm"
                  isIconOnly
                  isDisabled={sourceText === ''}
                  onPress={() => {
                    setDetectLanguage('')
                    setSourceNotice(null)
                    setSourceText('', true)
                  }}
                >
                  <LuDelete className="text-[16px]" />
                </Button>
              </Tooltip>
            </ButtonGroup>
            {detectLanguage !== '' && (
              <Chip size="sm" color="secondary" variant="dot" className="my-auto">
                {t(`languages.${detectLanguage}`)}
              </Chip>
            )}
          </div>
          <Tooltip content={t('translate.translate')}>
            <Button
              size="sm"
              color="primary"
              variant="light"
              isIconOnly
              className="text-[14px] font-bold"
              startContent={<HiTranslate className="text-[16px]" />}
              onPress={() => {
                detect_language(sourceText).then(() => {
                  syncSourceText()
                  setManualTranslateFlag(crypto.randomUUID())
                })
              }}
            />
          </Tooltip>
        </CardFooter>
      </Card>
      <Spacer y={2} />
    </div>
  )
}
