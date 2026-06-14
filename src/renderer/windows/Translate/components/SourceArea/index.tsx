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
import { BaseDirectory, readTextFile } from '@/renderer/lib/electron/compat/fs'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { writeText } from '@/renderer/lib/electron/compat/clipboard'
import { HiOutlineVolumeUp } from 'react-icons/hi'
import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { listen } from '@/renderer/lib/electron/compat/event'
import { MdContentCopy } from 'react-icons/md'
import { MdSmartButton } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { HiTranslate } from 'react-icons/hi'
import { LuDelete } from 'react-icons/lu'
import { nanoid } from 'nanoid'
import { atom, useAtom, useSetAtom } from 'jotai'
import {
  getServiceName,
  getServiceSouceType,
  isValidServiceInstanceKey,
  ServiceSourceType,
} from '@/renderer/lib/service/service_instance'
import { useConfig, useSyncAtom, useVoice } from '../../../../hooks'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import { electronCommand } from '@/renderer/lib/electron/command'
import * as recognizeServices from '@/renderer/providers/recognize'
import * as builtinTtsServices from '@/renderer/providers/tts'
import detect from '@/renderer/lib/language/lang_detect'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
const appWindow = getCurrentWebviewWindow()

export const sourceTextAtom = atom('')
export const detectLanguageAtom = atom('')
export const manualTranslateFlagAtom = atom('')

const DEFAULT_RECOGNIZE_SERVICE_LIST = ['local_model']
const DEFAULT_TTS_SERVICE_LIST = ['lingva']

type ServiceInstanceConfigMap = Record<string, Record<string, unknown>>

interface BuiltinRecognizeService {
  Language: Record<string, string>
  recognize(
    base64: string,
    language: string,
    options: { config: Record<string, unknown> | undefined },
  ): Promise<unknown>
}

interface BuiltinTtsService {
  Language: Record<string, string>
  tts(
    text: string,
    language: string,
    options: { config: Record<string, unknown> | undefined },
  ): Promise<unknown>
}

interface PluginLanguageInfo {
  language: Record<string, string>
}

interface SourceAreaProps {
  pluginList: EnabledServicePluginList
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

const recognizeServiceMap = recognizeServices as Record<string, BuiltinRecognizeService>
const builtinTtsServiceMap = builtinTtsServices as Record<string, BuiltinTtsService>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toWorkflowText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toResultText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.toString() : String(error)
}

function isAudioData(value: unknown): value is ArrayBuffer | ArrayLike<number> {
  return (
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array ||
    (Array.isArray(value) && value.every((item) => typeof item === 'number'))
  )
}

function assertAudioData(value: unknown): ArrayBuffer | ArrayLike<number> {
  if (!isAudioData(value)) {
    throw new Error('TTS provider returned invalid audio data.')
  }
  return value
}

function readPluginLanguageInfo(infoStr: string): PluginLanguageInfo | undefined {
  const parsed: unknown = JSON.parse(infoStr)
  if (!isRecord(parsed) || !isRecord(parsed.language)) {
    return undefined
  }

  return {
    language: Object.fromEntries(
      Object.entries(parsed.language).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  }
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
  const [ttsServiceList] = useConfig<string[]>('tts_service_list', DEFAULT_TTS_SERVICE_LIST)
  const ttsServiceInstanceKey = Array.isArray(ttsServiceList)
    ? ttsServiceList.find((key) => {
        if (!isValidServiceInstanceKey(key)) {
          return false
        }
        if (getServiceSouceType(key) === ServiceSourceType.PLUGIN) {
          return pluginList['tts']?.[getServiceName(key)] !== undefined
        }
        return builtinTtsServiceMap[getServiceName(key)] !== undefined
      })
    : null
  const [hideWindow] = useConfig('translate_hide_window', false)
  const [hideSource] = useConfig('hide_source', false)
  const [ttsPluginInfo, setTtsPluginInfo] = useState<PluginLanguageInfo>()
  const [windowType, setWindowType] = useState('[SELECTION_TRANSLATE]')
  const { t } = useTranslation()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const initialTextLoadedRef = useRef(false)
  const workflowTextVersionRef = useRef(0)
  const sourceTextChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speak = useVoice()

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

      setSourceText(nextText)
      await detect_language(nextText)
      syncSourceText(nextText)
    },
    [detect_language, incrementalTranslate, setSourceText, sourceText, syncSourceText],
  )

  const handleNewText = useCallback(
    async (payload: unknown) => {
      const text = toWorkflowText(payload).trim()
      if (hideWindow) {
        appWindow.hide()
      } else {
        appWindow.show()
        appWindow.setFocus()
      }
      setDetectLanguage('')
      if (text === '') {
        setWindowType('[SELECTION_TRANSLATE]')
        setSourceText('', true)
        syncSourceText('')
      } else if (text === '[INPUT_TRANSLATE]') {
        setWindowType('[INPUT_TRANSLATE]')
        appWindow.show()
        appWindow.setFocus()
        setSourceText('', true)
      } else if (text === '[IMAGE_TRANSLATE]') {
        setWindowType('[IMAGE_TRANSLATE]')
        if (
          recognizeServiceList === null ||
          recognizeLanguage === null ||
          recognizeServiceList.length === 0
        ) {
          setSourceText(t('errors.recognize_service_not_configured'))
          return
        }
        const base64 = String(await electronCommand('get_base64'))
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
            const instanceConfig = serviceInstanceConfigMap[serviceInstanceKey]
            recognizeService
              .recognize(base64, recognizeService.Language[recognizeLanguage], {
                config: instanceConfig,
              })
              .then(
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
      } else {
        setWindowType('[SELECTION_TRANSLATE]')
        await commitSourceText(normalizeInputText(text))
      }
    },
    [
      commitSourceText,
      hideWindow,
      normalizeInputText,
      pluginList,
      recognizeLanguage,
      recognizeServiceList,
      serviceInstanceConfigMap,
      setDetectLanguage,
      setSourceText,
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
    if (event.key === 'Escape') {
      appWindow.close()
    }
  }

  const handleNewTextRef = useRef(handleNewText)

  useEffect(() => {
    handleNewTextRef.current = handleNewText
  }, [handleNewText])

  const handleSpeak = async () => {
    const instanceKey = ttsServiceInstanceKey
    if (!instanceKey) {
      throw new Error(t('translate.tts_not_configured'))
    }
    let detected = detectLanguage
    if (detected === '') {
      detected = String(await detect(sourceText))
      setDetectLanguage(detected)
    }
    if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
      if (!ttsPluginInfo?.language) {
        throw new Error(t('translate.tts_not_configured'))
      }
      if (!(detected in ttsPluginInfo.language)) {
        throw new Error(t('errors.language_not_supported'))
      }
      const pluginConfig = serviceInstanceConfigMap[instanceKey]
      const [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey))
      const data = await func(sourceText, ttsPluginInfo.language[detected], {
        config: pluginConfig,
        utils,
      })
      await speak(assertAudioData(data))
    } else {
      if (!(detected in builtinTtsServiceMap[getServiceName(instanceKey)].Language)) {
        throw new Error(t('errors.language_not_supported'))
      }
      const instanceConfig = serviceInstanceConfigMap[instanceKey]
      const data = await builtinTtsServiceMap[getServiceName(instanceKey)].tts(
        sourceText,
        builtinTtsServiceMap[getServiceName(instanceKey)].Language[detected],
        {
          config: instanceConfig,
        },
      )
      await speak(assertAudioData(data))
    }
  }

  useEffect(() => {
    let disposed = false
    let removeListener: (() => void) | null = null
    const unlistenPromise = listen('new_text', (event) => {
      appWindow.setFocus()
      workflowTextVersionRef.current += 1
      void handleNewTextRef.current(event.payload).catch((error) => {
        reportSourceAreaError(error, 'translate.new_text')
      })
    })
    unlistenPromise.then(
      (unlisten) => {
        removeListener = unlisten
        void window.neoPot?.app.rendererReady()
        if (disposed) {
          removeListener = null
          unlisten()
        }
      },
      (error: unknown) => {
        reportSourceAreaError(error, 'translate.new_text_listener')
      },
    )

    return () => {
      disposed = true
      if (removeListener) {
        removeListener()
      } else {
        unlistenPromise.then(
          (unlisten) => {
            unlisten()
          },
          () => undefined,
        )
      }
    }
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
    if (
      ttsServiceInstanceKey &&
      getServiceSouceType(ttsServiceInstanceKey) === ServiceSourceType.PLUGIN
    ) {
      readTextFile(`plugins/tts/${getServiceName(ttsServiceInstanceKey)}/info.json`, {
        baseDir: BaseDirectory.AppConfig,
      }).then(
        (infoStr) => {
          setTtsPluginInfo(readPluginLanguageInfo(infoStr))
        },
        () => {
          setTtsPluginInfo(undefined)
        },
      )
    }
  }, [ttsServiceInstanceKey])

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
      electronCommand('get_text').then((v) => {
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
    <div className={hideSource && windowType !== '[INPUT_TRANSLATE]' ? 'hidden' : undefined}>
      <Card shadow="none" className="bg-content1 rounded-[10px] mt-px pb-0">
        <CardBody className="bg-content1 p-3 pb-0 max-h-[40vh] overflow-y-auto">
          <textarea
            autoFocus
            ref={textAreaRef}
            className={`text-[${appFontSize}px] bg-content1 h-full resize-none outline-none`}
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
                    writeText(sourceText)
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
                  setManualTranslateFlag(nanoid())
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
