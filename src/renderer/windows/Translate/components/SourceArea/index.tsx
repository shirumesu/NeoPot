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
import toast, { Toaster } from 'react-hot-toast'
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
import { useConfig, useSyncAtom, useVoice, useToastStyle } from '../../../../hooks'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import { electronCommand } from '@/renderer/lib/electron/command'
import * as recognizeServices from '@/renderer/providers/recognize'
import * as builtinTtsServices from '@/renderer/providers/tts'
import detect from '@/renderer/lib/language/lang_detect'
const appWindow = getCurrentWebviewWindow()

export const sourceTextAtom = atom('')
export const detectLanguageAtom = atom('')
export const manualTranslateFlagAtom = atom('')

const DEFAULT_RECOGNIZE_SERVICE_LIST = ['local_model']
const DEFAULT_TTS_SERVICE_LIST = []

export default function SourceArea(props) {
  const { pluginList, serviceInstanceConfigMap } = props
  const [appFontSize] = useConfig('app_font_size', 16)
  const [sourceText, setSourceText, syncSourceText] = useSyncAtom(sourceTextAtom)
  const [detectLanguage, setDetectLanguage] = useAtom(detectLanguageAtom)
  const setManualTranslateFlag = useSetAtom(manualTranslateFlagAtom)
  const [incrementalTranslate] = useConfig('incremental_translate', false)
  const [dynamicTranslate] = useConfig('dynamic_translate', false)
  const [deleteNewline] = useConfig('translate_delete_newline', false)
  const [recognizeLanguage] = useConfig('recognize_language', 'auto')
  const [recognizeServiceList] = useConfig('recognize_service_list', DEFAULT_RECOGNIZE_SERVICE_LIST)
  const [ttsServiceList] = useConfig('tts_service_list', DEFAULT_TTS_SERVICE_LIST)
  const ttsServiceInstanceKey = Array.isArray(ttsServiceList)
    ? ttsServiceList.find((key) => {
        if (!isValidServiceInstanceKey(key)) {
          return false
        }
        if (getServiceSouceType(key) === ServiceSourceType.PLUGIN) {
          return pluginList['tts']?.[getServiceName(key)] !== undefined
        }
        return builtinTtsServices[getServiceName(key)] !== undefined
      })
    : null
  const [hideWindow] = useConfig('translate_hide_window', false)
  const [hideSource] = useConfig('hide_source', false)
  const [ttsPluginInfo, setTtsPluginInfo] = useState<any>()
  const [windowType, setWindowType] = useState('[SELECTION_TRANSLATE]')
  const toastStyle = useToastStyle()
  const { t } = useTranslation()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const initialTextLoadedRef = useRef(false)
  const sourceTextChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speak = useVoice()

  const detect_language = useCallback(
    async (text) => {
      setDetectLanguage(await detect(text))
    },
    [setDetectLanguage],
  )

  const normalizeInputText = useCallback(
    (text) => {
      const trimmedText = text.trim()
      if (deleteNewline) {
        return trimmedText.replace(/-\s+/g, '').replace(/\s+/g, ' ')
      }

      return trimmedText
    },
    [deleteNewline],
  )

  const commitSourceText = useCallback(
    async (newText) => {
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
    async (text) => {
      text = text.trim()
      if (hideWindow) {
        appWindow.hide()
      } else {
        appWindow.show()
        appWindow.setFocus()
      }
      // 清空检测语言
      setDetectLanguage('')
      if (text === '[INPUT_TRANSLATE]') {
        setWindowType('[INPUT_TRANSLATE]')
        appWindow.show()
        appWindow.setFocus()
        setSourceText('', true)
      } else if (text === '[IMAGE_TRANSLATE]') {
        setWindowType('[IMAGE_TRANSLATE]')
        const base64 = String(await electronCommand('get_base64'))
        const serviceInstanceKey = recognizeServiceList[0]
        if (getServiceSouceType(serviceInstanceKey) === ServiceSourceType.PLUGIN) {
          if (
            recognizeLanguage in
            pluginList['recognize'][getServiceName(serviceInstanceKey)].language
          ) {
            const pluginConfig = serviceInstanceConfigMap[serviceInstanceKey]

            const [func, utils] = await invoke_plugin(
              'recognize',
              getServiceName(serviceInstanceKey),
            )
            func(
              base64,
              pluginList['recognize'][getServiceName(serviceInstanceKey)].language[
                recognizeLanguage
              ],
              {
                config: pluginConfig,
                utils,
              },
            ).then(
              (v) => {
                void commitSourceText(normalizeInputText(v))
              },
              (e) => {
                setSourceText(e.toString())
              },
            )
          } else {
            setSourceText('Language not supported')
          }
        } else {
          if (recognizeLanguage in recognizeServices[getServiceName(serviceInstanceKey)].Language) {
            const instanceConfig = serviceInstanceConfigMap[serviceInstanceKey]
            recognizeServices[getServiceName(serviceInstanceKey)]
              .recognize(
                base64,
                recognizeServices[getServiceName(serviceInstanceKey)].Language[recognizeLanguage],
                {
                  config: instanceConfig,
                },
              )
              .then(
                (v) => {
                  void commitSourceText(normalizeInputText(v))
                },
                (e) => {
                  setSourceText(e.toString())
                },
              )
          } else {
            setSourceText('Language not supported')
          }
        }
      } else {
        setWindowType('[SELECTION_TRANSLATE]')
        await commitSourceText(normalizeInputText(text))
      }
    },
    [
      commitSourceText,
      detect_language,
      hideWindow,
      normalizeInputText,
      pluginList,
      recognizeLanguage,
      recognizeServiceList,
      serviceInstanceConfigMap,
      setDetectLanguage,
      setSourceText,
      syncSourceText,
    ],
  )

  const keyDown = (event) => {
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
      detected = await detect(sourceText)
      setDetectLanguage(detected)
    }
    if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
      if (!ttsPluginInfo?.language) {
        throw new Error(t('translate.tts_not_configured'))
      }
      if (!(detected in ttsPluginInfo.language)) {
        throw new Error('Language not supported')
      }
      const pluginConfig = serviceInstanceConfigMap[instanceKey]
      const [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey))
      const data = await func(sourceText, ttsPluginInfo.language[detected], {
        config: pluginConfig,
        utils,
      })
      speak(data)
    } else {
      if (!(detected in builtinTtsServices[getServiceName(instanceKey)].Language)) {
        throw new Error('Language not supported')
      }
      const instanceConfig = serviceInstanceConfigMap[instanceKey]
      const data = await (builtinTtsServices[getServiceName(instanceKey)] as any).tts(
        sourceText,
        (builtinTtsServices[getServiceName(instanceKey)] as any).Language[detected],
        {
          config: instanceConfig,
        },
      )
      speak(data)
    }
  }

  useEffect(() => {
    let disposed = false
    let removeListener = null
    const unlistenPromise = listen('new_text', (event) => {
      appWindow.setFocus()
      handleNewTextRef.current(event.payload)
    })
    unlistenPromise.then((unlisten) => {
      if (disposed) {
        unlisten()
      } else {
        removeListener = unlisten
        void window.neoPot?.app.rendererReady()
      }
    })

    return () => {
      disposed = true
      if (removeListener) {
        removeListener()
      } else {
        unlistenPromise.then((unlisten) => {
          unlisten()
        })
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
          setTtsPluginInfo(JSON.parse(infoStr))
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
      electronCommand('get_text').then((v) => {
        handleNewText(String(v))
      })
    }
  }, [
    deleteNewline,
    incrementalTranslate,
    recognizeLanguage,
    recognizeServiceList,
    hideWindow,
    handleNewText,
  ])

  useEffect(() => {
    if (!textAreaRef.current) {
      return
    }
    textAreaRef.current.style.height = '50px'
    textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px'
  }, [sourceText])

  const changeSourceText = async (text) => {
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
      }, 1000)
    }
  }

  const transformVarName = function (str) {
    let str2 = str

    // snake_case to SNAKE_CASE
    if (/_[a-z]/.test(str2)) {
      str2 = str2
        .split('_')
        .map((it) => it.toLocaleUpperCase())
        .join('_')
    }
    if (str2 !== str) {
      return str2
    }

    // SNAKE_CASE to kebab-case
    if (/^[A-Z]+(_[A-Z]+)*$/.test(str2)) {
      str2 = str2
        .split('_')
        .map((it) => it.toLocaleLowerCase())
        .join('-')
    }
    if (str2 !== str) {
      return str2
    }

    // kebab-case to dot.notation
    if (/-/.test(str2)) {
      str2 = str2
        .split('-')
        .map((it) => it.toLocaleLowerCase())
        .join('.')
    }
    if (str2 !== str) {
      return str2
    }

    // dot.notation to space separated
    if (/\.[a-z]/.test(str2)) {
      str2 = str2.replaceAll(/(\.)([a-z])/g, (_, _2, it) => ' ' + it)
    }
    if (str2 !== str) {
      return str2
    }

    // space separated to Title Case
    if (/\s[a-z]/.test(str2)) {
      str2 = str2.replaceAll(/\s([a-z])/g, (_, it) => ' ' + it.toLocaleUpperCase())
      str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1)
    }
    if (str2 !== str) {
      return str2
    }

    // Title Case to CamelCase
    if (/\s[A-Z]/.test(str2)) {
      str2 = str2.replaceAll(/\s([A-Z])/g, (_, it) => it)
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
      str2 = str2.replaceAll(/[A-Z]/g, (it, offset) => {
        return (offset == 0 ? '' : '_') + it.toLocaleLowerCase()
      })
    }

    return str2
  }
  useEffect(() => {
    const element = textAreaRef.current
    if (!element) {
      return
    }

    const onKeyDown = async (event) => {
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
  }, [])

  return (
    <div className={hideSource && windowType !== '[INPUT_TRANSLATE]' && 'hidden'}>
      <Card shadow="none" className="bg-content1 rounded-[10px] mt-px pb-0">
        <Toaster />
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
                      toast.error(e.toString(), { style: toastStyle })
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
                    setSourceText('')
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
