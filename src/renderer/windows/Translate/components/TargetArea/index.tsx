import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  ButtonGroup,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from '@heroui/react'
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi'
import { BaseDirectory, readTextFile } from '@/renderer/lib/electron/compat/fs'
import { sendNotification } from '@/renderer/lib/electron/compat/notification'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { writeText } from '@/renderer/lib/electron/compat/clipboard'
import { PulseLoader } from 'react-spinners'
import { TbTransformFilled } from 'react-icons/tb'
import { HiOutlineVolumeUp } from 'react-icons/hi'
import { semanticColors } from '@heroui/theme'
import { MdArticle, MdCode, MdContentCopy } from 'react-icons/md'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { GiCycle } from 'react-icons/gi'
import { useTheme } from 'next-themes'
import { useAtomValue } from 'jotai'
import { nanoid } from 'nanoid'
import { useSpring, animated } from '@react-spring/web'
import useMeasure from 'react-use-measure'

import { sourceLanguageAtom, targetLanguageAtom } from '../LanguageArea'
import { useConfig, useVoice } from '../../../../hooks'
import { sourceTextAtom, detectLanguageAtom, manualTranslateFlagAtom } from '../SourceArea'
import { invoke_plugin } from '@/renderer/lib/plugin/invoke_plugin'
import * as builtinServices from '@/renderer/providers/translate'
import * as builtinTtsServices from '@/renderer/providers/tts'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'

import { logger } from '@/renderer/lib/logger'
import {
  INSTANCE_NAME_CONFIG_KEY,
  ServiceSourceType,
  getDisplayInstanceName,
  getServiceName,
  getServiceSouceType,
  isValidServiceInstanceKey,
  whetherPluginService,
} from '@/renderer/lib/service/service_instance'

const AnimatedDiv = animated.div as unknown as React.ComponentType<
  React.PropsWithChildren<{ style?: unknown }>
>

const translateID: string[] = []

type ServiceInstanceConfigMap = Record<string, Record<string, unknown>>

interface BuiltinTranslateService {
  info: {
    icon: string
  }
  Language: Record<string, string>
  translate(
    text: string,
    from: string,
    to: string,
    options: {
      config: Record<string, unknown>
      detect?: string
      setResult?: (value: unknown) => void
    },
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

interface TargetAreaProps {
  index: number
  name: string
  translateServiceInstanceList: string[]
  pluginList: EnabledServicePluginList
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

interface PronunciationResult {
  region?: string
  symbol?: string
  voice?: unknown
}

interface ExplanationResult {
  trait?: string
  explains: string[]
}

interface SentenceResult {
  source?: string
  target?: string
}

interface RichTranslationResult {
  pronunciations: PronunciationResult[]
  explanations: ExplanationResult[]
  associations: string[]
  sentence: SentenceResult[]
}

type TranslationResult = string | RichTranslationResult

const builtinServiceMap = builtinServices as Record<string, BuiltinTranslateService>
const builtinTtsServiceMap = builtinTtsServices as Record<string, BuiltinTtsService>

const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+\S/m,
  /^>\s+\S/m,
  /^[-*+]\s+\S/m,
  /^\d+\.\s+\S/m,
  /^```/m,
  /`[^`\n]+`/,
  /\[[^\]]+\]\([^)]+\)/,
  /^-{3,}\s*$/m,
  /(?<!\w)\*\*[^\s*][^*\n]*\*\*(?!\w)/,
  /(?<!\w)__[^\s_][^_\n]*__(?!\w)/,
  /(?<!\w)\*[^\s*][^*\n]*\*(?!\w)/,
  /(?<!\w)_[^\s_][^_\n]*_(?!\w)/,
  /~~[^\s~][^~\n]*~~/,
]

const MARKDOWN_TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/m
const SAFE_RICH_TEXT_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br'])
const DROPPED_RICH_TEXT_TAGS = new Set([
  'script',
  'style',
  'template',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
])

function isMarkdownLike(value: unknown) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (text.length < 3) return false

  return (
    MARKDOWN_TABLE_SEPARATOR_PATTERN.test(text) ||
    MARKDOWN_PATTERNS.some((pattern) => pattern.test(text))
  )
}

function MarkdownResult({ value, appFontSize }: { value: string; appFontSize: number }) {
  return (
    <div
      className="select-text whitespace-pre-wrap wrap-break-word text-default-700"
      style={{ fontSize: `${appFontSize}px` }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 text-[1.35em] font-semibold">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-[1.2em] font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-[1.1em] font-semibold">{children}</h3>
          ),
          h4: ({ children }) => <h4 className="mb-1.5 mt-2 font-semibold">{children}</h4>,
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-default-300 pl-3 text-default-500">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => (
            <code
              className={`${className ?? ''} rounded-small bg-default-100 px-1 py-0.5 font-mono text-[0.92em]`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-small bg-default-100 p-2 leading-relaxed [&_code]:block [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-default-200" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-default-200 bg-default-100 px-2 py-1 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-default-200 px-2 py-1">{children}</td>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

function renderSafeRichTextNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === 3) {
    return node.textContent ?? ''
  }

  if (node.nodeType !== 1) {
    return null
  }

  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  if (DROPPED_RICH_TEXT_TAGS.has(tagName)) {
    return null
  }

  const children = Array.from(element.childNodes).map((child, childIndex) =>
    renderSafeRichTextNode(child, `${key}-${childIndex}`),
  )

  if (!SAFE_RICH_TEXT_TAGS.has(tagName)) {
    return <React.Fragment key={key}>{children}</React.Fragment>
  }

  switch (tagName) {
    case 'b':
    case 'strong':
      return <strong key={key}>{children}</strong>
    case 'i':
    case 'em':
      return <em key={key}>{children}</em>
    case 'u':
      return <u key={key}>{children}</u>
    case 'br':
      return <br key={key} />
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>
  }
}

function renderSafeRichText(value: string): React.ReactNode[] {
  if (typeof DOMParser === 'undefined') {
    return [value]
  }

  const doc = new DOMParser().parseFromString(value, 'text/html')
  return Array.from(doc.body.childNodes).map((node, index) =>
    renderSafeRichTextNode(node, String(index)),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toRichTranslationResult(value: Record<string, unknown>): RichTranslationResult {
  return {
    pronunciations: toArray(value.pronunciations).map((item) => {
      const pronunciation = isRecord(item) ? item : {}
      return {
        region: toOptionalText(pronunciation.region),
        symbol: toOptionalText(pronunciation.symbol),
        voice: pronunciation.voice,
      }
    }),
    explanations: toArray(value.explanations).map((item) => {
      const explanation = isRecord(item) ? item : {}
      return {
        trait: toOptionalText(explanation.trait),
        explains: toArray(explanation.explains).map(toText),
      }
    }),
    associations: toArray(value.associations).map(toText),
    sentence: toArray(value.sentence).map((item) => {
      const sentence = isRecord(item) ? item : {}
      return {
        source: toOptionalText(sentence.source),
        target: toOptionalText(sentence.target),
      }
    }),
  }
}

function toTranslationResult(value: unknown): TranslationResult {
  if (typeof value === 'string') {
    return value
  }
  if (isRecord(value)) {
    return toRichTranslationResult(value)
  }
  return toText(value)
}

function hasVisibleResult(value: unknown): boolean {
  return typeof value === 'string' ? value !== '' : value !== undefined && value !== null
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

function invokeOnce<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
  let isInvoke = false

  return (...args: TArgs) => {
    if (isInvoke) {
      return
    } else {
      fn(...args)
      isInvoke = true
    }
  }
}

export default function TargetArea(props: TargetAreaProps) {
  const { index, name, translateServiceInstanceList, pluginList, serviceInstanceConfigMap } = props

  const [currentTranslateServiceInstanceKey, setCurrentTranslateServiceInstanceKey] = useState(name)
  function getInstanceName(instanceKey: string, serviceNameSupplier: () => string) {
    const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {}
    const instanceName = instanceConfig[INSTANCE_NAME_CONFIG_KEY]
    return getDisplayInstanceName(
      typeof instanceName === 'string' ? instanceName : '',
      serviceNameSupplier,
    )
  }

  const [appFontSize] = useConfig('app_font_size', 16)
  const resolvedAppFontSize = appFontSize ?? 16
  const [ttsServiceList] = useConfig<string[]>('tts_service_list', ['lingva'])
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
  const [translateSecondLanguage] = useConfig('translate_second_language', 'en')
  const [isLoading, setIsLoading] = useState(false)
  const [hide, setHide] = useState(true)

  const [result, setResult] = useState<TranslationResult>('')
  const [error, setError] = useState('')
  const [resultViewMode, setResultViewMode] = useState<'markdown' | 'source' | null>(null)

  const sourceText = useAtomValue(sourceTextAtom)
  const manualTranslateFlag = useAtomValue(manualTranslateFlagAtom)
  const sourceLanguage = useAtomValue(sourceLanguageAtom)
  const targetLanguage = useAtomValue(targetLanguageAtom)
  const [autoCopy] = useConfig('translate_auto_copy', 'disable')
  const [hideWindow] = useConfig('translate_hide_window', false)
  const [clipboardMonitor] = useConfig('clipboard_monitor', false)

  const detectLanguage = useAtomValue(detectLanguageAtom)
  const effectiveDetectLanguage = sourceLanguage === 'auto' ? detectLanguage : ''
  const [ttsPluginInfo, setTtsPluginInfo] = useState<PluginLanguageInfo>()
  const { t } = useTranslation()
  const getTranslateServiceNotConfiguredMessage = useCallback(
    () => t('errors.translate_service_not_configured'),
    [t],
  )
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const speak = useVoice()
  const { theme } = useTheme()

  useEffect(() => {
    if (error) {
      logger.warn('Translation displayed an error.', {
        service: currentTranslateServiceInstanceKey,
        message: error,
      })
    }
  }, [currentTranslateServiceInstanceKey, error])

  const translate = useCallback(async () => {
    const id = nanoid()
    const startedAt = Date.now()
    translateID[index] = id

    const translateServiceName = getServiceName(currentTranslateServiceInstanceKey)
    const resolvedSourceLanguage = sourceLanguage
    const resolveTargetLanguage = () => {
      if (resolvedSourceLanguage === 'auto' && targetLanguage === effectiveDetectLanguage) {
        return translateSecondLanguage
      }

      return targetLanguage
    }
    const resolvedTargetLanguage = resolveTargetLanguage()
    if (resolvedTargetLanguage === null) {
      setError(t('errors.language_not_supported'))
      return
    }
    const providerDetectLanguage =
      resolvedSourceLanguage === 'auto' ? effectiveDetectLanguage || 'auto' : resolvedSourceLanguage
    logger.debug('Translation requested.', {
      service: currentTranslateServiceInstanceKey,
      from: resolvedSourceLanguage,
      to: resolvedTargetLanguage,
      inputLength: sourceText.trim().length,
    })

    if (whetherPluginService(currentTranslateServiceInstanceKey)) {
      const pluginInfo = pluginList['translate'][translateServiceName]
      if (!pluginInfo?.language) {
        setError(getTranslateServiceNotConfiguredMessage())
        return
      }
      if (
        resolvedSourceLanguage in pluginInfo.language &&
        resolvedTargetLanguage in pluginInfo.language
      ) {
        setIsLoading(true)
        setHide(true)
        const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey]
        if (instanceConfig === undefined) {
          setIsLoading(false)
          setError(getTranslateServiceNotConfiguredMessage())
          return
        }
        instanceConfig['enable'] = 'true'
        const setHideOnce = invokeOnce(setHide)
        const [func, utils] = await invoke_plugin('translate', translateServiceName)
        func(
          sourceText.trim(),
          pluginInfo.language[resolvedSourceLanguage],
          pluginInfo.language[resolvedTargetLanguage],
          {
            config: instanceConfig,
            detect: providerDetectLanguage,
            setResult: (v: unknown) => {
              if (translateID[index] !== id) return
              setResult(toTranslationResult(v))
              setHideOnce(false)
            },
            utils,
          },
        ).then(
          (v) => {
            if (translateID[index] !== id) return
            logger.debug('Translation completed.', {
              service: currentTranslateServiceInstanceKey,
              from: resolvedSourceLanguage,
              to: resolvedTargetLanguage,
              inputLength: sourceText.trim().length,
              outputLength: typeof v === 'string' ? v.length : 0,
              durationMs: Date.now() - startedAt,
            })
            const clipboardText = typeof v === 'string' ? v : null
            setResult(toTranslationResult(typeof v === 'string' ? v.trim() : v))
            setIsLoading(false)
            if (hasVisibleResult(v)) {
              setHideOnce(false)
            }
            if (clipboardText !== null && index === 0 && !clipboardMonitor) {
              switch (autoCopy) {
                case 'target':
                  writeText(clipboardText).then(() => {
                    if (hideWindow) {
                      sendNotification({
                        title: t('common.write_clipboard'),
                        body: clipboardText,
                      })
                    }
                  })
                  break
                case 'source_target':
                  writeText(sourceText.trim() + '\n\n' + clipboardText).then(() => {
                    if (hideWindow) {
                      sendNotification({
                        title: t('common.write_clipboard'),
                        body: sourceText.trim() + '\n\n' + clipboardText,
                      })
                    }
                  })
                  break
                default:
                  break
              }
            }
          },
          (e: unknown) => {
            if (translateID[index] !== id) return
            reportRuntimeError(e, {
              source: 'translate.plugin',
              logMessage: 'Translation plugin rejected.',
              toastId: `translate.plugin:${currentTranslateServiceInstanceKey}`,
              context: {
                service: currentTranslateServiceInstanceKey,
                from: resolvedSourceLanguage,
                to: resolvedTargetLanguage,
                inputLength: sourceText.trim().length,
                durationMs: Date.now() - startedAt,
              },
            })
            setError(toErrorMessage(e))
            setIsLoading(false)
          },
        )
      } else {
        setError(t('errors.language_not_supported'))
      }
    } else {
      const builtinService = builtinServiceMap[translateServiceName]
      if (!builtinService) {
        setError(getTranslateServiceNotConfiguredMessage())
        return
      }
      const LanguageEnum = builtinService.Language
      if (resolvedSourceLanguage in LanguageEnum && resolvedTargetLanguage in LanguageEnum) {
        setIsLoading(true)
        setHide(true)
        const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey]
        if (instanceConfig === undefined) {
          setIsLoading(false)
          setError(getTranslateServiceNotConfiguredMessage())
          return
        }
        const setHideOnce = invokeOnce(setHide)
        builtinService
          .translate(
            sourceText.trim(),
            LanguageEnum[resolvedSourceLanguage],
            LanguageEnum[resolvedTargetLanguage],
            {
              config: instanceConfig,
              detect: providerDetectLanguage,
              setResult: (v: unknown) => {
                if (translateID[index] !== id) return
                setResult(toTranslationResult(v))
                setHideOnce(false)
              },
            },
          )
          .then(
            (v) => {
              if (translateID[index] !== id) return
              logger.debug('Translation completed.', {
                service: currentTranslateServiceInstanceKey,
                from: resolvedSourceLanguage,
                to: resolvedTargetLanguage,
                inputLength: sourceText.trim().length,
                outputLength: typeof v === 'string' ? v.length : 0,
                durationMs: Date.now() - startedAt,
              })
              const clipboardText = typeof v === 'string' ? v : null
              setResult(toTranslationResult(typeof v === 'string' ? v.trim() : v))
              setIsLoading(false)
              if (hasVisibleResult(v)) {
                setHideOnce(false)
              }
              if (clipboardText !== null && index === 0 && !clipboardMonitor) {
                switch (autoCopy) {
                  case 'target':
                    writeText(clipboardText).then(() => {
                      if (hideWindow) {
                        sendNotification({
                          title: t('common.write_clipboard'),
                          body: clipboardText,
                        })
                      }
                    })
                    break
                  case 'source_target':
                    writeText(sourceText.trim() + '\n\n' + clipboardText).then(() => {
                      if (hideWindow) {
                        sendNotification({
                          title: t('common.write_clipboard'),
                          body: sourceText.trim() + '\n\n' + clipboardText,
                        })
                      }
                    })
                    break
                  default:
                    break
                }
              }
            },
            (e: unknown) => {
              if (translateID[index] !== id) return
              reportRuntimeError(e, {
                source: 'translate.builtin',
                logMessage: 'Translation provider rejected.',
                toastId: `translate.builtin:${currentTranslateServiceInstanceKey}`,
                context: {
                  service: currentTranslateServiceInstanceKey,
                  from: resolvedSourceLanguage,
                  to: resolvedTargetLanguage,
                  inputLength: sourceText.trim().length,
                  durationMs: Date.now() - startedAt,
                },
              })
              setError(toErrorMessage(e))
              setIsLoading(false)
            },
          )
      } else {
        setError(t('errors.language_not_supported'))
      }
    }
  }, [
    autoCopy,
    clipboardMonitor,
    currentTranslateServiceInstanceKey,
    effectiveDetectLanguage,
    hideWindow,
    index,
    getTranslateServiceNotConfiguredMessage,
    pluginList,
    serviceInstanceConfigMap,
    sourceLanguage,
    sourceText,
    t,
    targetLanguage,
    translateSecondLanguage,
  ])

  // listen to translation
  useEffect(() => {
    setResult('')
    setError('')
    setResultViewMode(null)
    const canTranslate =
      sourceText.trim() !== '' &&
      sourceLanguage &&
      targetLanguage &&
      autoCopy !== null &&
      hideWindow !== null &&
      clipboardMonitor !== null

    if (!canTranslate) {
      translateID[index] = ''
      setIsLoading(false)
      setHide(true)
      return
    }

    if (autoCopy === 'source' && !clipboardMonitor) {
      writeText(sourceText).then(() => {
        if (hideWindow) {
          sendNotification({
            title: t('common.write_clipboard'),
            body: sourceText,
          })
        }
      })
    }
    void translate().catch((error) => {
      reportRuntimeError(error, {
        source: 'translate.request',
        logMessage: 'Translation request failed.',
        toastId: `translate.request:${currentTranslateServiceInstanceKey}`,
        context: {
          service: currentTranslateServiceInstanceKey,
        },
      })
      setError(error instanceof Error ? error.toString() : String(error))
      setIsLoading(false)
    })
  }, [
    autoCopy,
    clipboardMonitor,
    currentTranslateServiceInstanceKey,
    hideWindow,
    index,
    manualTranslateFlag,
    sourceLanguage,
    sourceText,
    t,
    targetLanguage,
    translate,
  ])

  // hide empty textarea
  useEffect(() => {
    if (textAreaRef.current !== null) {
      textAreaRef.current.style.height = '0px'
      if (result !== '') {
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px'
      }
    }
  }, [result, resultViewMode])

  // refresh tts config
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

  // handle tts speak
  const handleSpeak = async () => {
    const instanceKey = ttsServiceInstanceKey
    if (!instanceKey) {
      throw new Error(t('translate.tts_not_configured'))
    }
    if (typeof result !== 'string') {
      throw new Error(t('errors.language_not_supported'))
    }
    if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
      const pluginConfig = serviceInstanceConfigMap[instanceKey]
      if (!ttsPluginInfo?.language) {
        throw new Error(t('translate.tts_not_configured'))
      }
      if (!(targetLanguage in ttsPluginInfo.language)) {
        throw new Error(t('errors.language_not_supported'))
      }
      const [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey))
      const data = await func(result, ttsPluginInfo.language[targetLanguage], {
        config: pluginConfig,
        utils,
      })
      await speak(assertAudioData(data))
    } else {
      if (!(targetLanguage in builtinTtsServiceMap[getServiceName(instanceKey)].Language)) {
        throw new Error(t('errors.language_not_supported'))
      }
      const instanceConfig = serviceInstanceConfigMap[instanceKey]
      const data = await builtinTtsServiceMap[getServiceName(instanceKey)].tts(
        result,
        builtinTtsServiceMap[getServiceName(instanceKey)].Language[targetLanguage],
        {
          config: instanceConfig,
        },
      )
      await speak(assertAudioData(data))
    }
  }

  const [boundRef, bounds] = useMeasure({ scroll: true })
  const springs = useSpring({
    from: { height: 0 },
    to: { height: hide ? 0 : bounds.height },
  })
  const canPreviewMarkdown = typeof result === 'string' && result !== '' && isMarkdownLike(result)
  const activeResultViewMode = resultViewMode ?? (canPreviewMarkdown ? 'markdown' : 'source')

  return (
    <Card shadow="none" className="rounded-[10px]">
      <CardHeader
        className={`flex justify-between py-1 px-0 bg-content2 h-7.5 ${hide ? 'rounded-[10px]' : 'rounded-t-[10px]'}`}
      >
        {/* current service instance and available service instance to change */}
        <div className="flex">
          <Dropdown>
            <DropdownTrigger>
              <Button
                size="sm"
                variant="solid"
                className="bg-transparent"
                startContent={
                  whetherPluginService(currentTranslateServiceInstanceKey) ? (
                    <img
                      src={
                        pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)]
                          .icon
                      }
                      className="h-5 my-auto"
                    />
                  ) : (
                    <img
                      src={
                        builtinServiceMap[getServiceName(currentTranslateServiceInstanceKey)].info
                          .icon
                      }
                      className="h-5 my-auto"
                    />
                  )
                }
              >
                {whetherPluginService(currentTranslateServiceInstanceKey) ? (
                  <div className="my-auto">{`${getInstanceName(currentTranslateServiceInstanceKey, () => pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)].display)} `}</div>
                ) : (
                  <div className="my-auto">
                    {getInstanceName(currentTranslateServiceInstanceKey, () =>
                      t(
                        `services.translate.${getServiceName(currentTranslateServiceInstanceKey)}.title`,
                      ),
                    )}
                  </div>
                )}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={t('accessibility.translate_service')}
              className="max-h-[40vh] overflow-y-auto"
              onAction={(key: React.Key) => {
                setCurrentTranslateServiceInstanceKey(String(key))
              }}
            >
              {translateServiceInstanceList.map((instanceKey: string) => {
                return (
                  <DropdownItem
                    key={instanceKey}
                    startContent={
                      whetherPluginService(instanceKey) ? (
                        <img
                          src={pluginList['translate'][getServiceName(instanceKey)].icon}
                          className="h-5 my-auto"
                        />
                      ) : (
                        <img
                          src={builtinServiceMap[getServiceName(instanceKey)].info.icon}
                          className="h-5 my-auto"
                        />
                      )
                    }
                  >
                    {whetherPluginService(instanceKey) ? (
                      <div className="my-auto">{`${getInstanceName(instanceKey, () => pluginList['translate'][getServiceName(instanceKey)].display)} `}</div>
                    ) : (
                      <div className="my-auto">
                        {getInstanceName(instanceKey, () =>
                          t(`services.translate.${getServiceName(instanceKey)}.title`),
                        )}
                      </div>
                    )}
                  </DropdownItem>
                )
              })}
            </DropdownMenu>
          </Dropdown>
          <PulseLoader
            loading={isLoading}
            color={
              theme === 'dark'
                ? semanticColors.dark.default[500]
                : semanticColors.light.default[500]
            }
            size={8}
            cssOverride={{
              display: 'inline-block',
              margin: 'auto',
              marginLeft: '20px',
            }}
          />
        </div>
        {/* content collapse */}
        <div className="flex">
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="h-5 w-5"
            onPress={() => setHide(!hide)}
          >
            {hide ? (
              <BiExpandVertical className="text-[16px]" />
            ) : (
              <BiCollapseVertical className="text-[16px]" />
            )}
          </Button>
        </div>
      </CardHeader>
      <AnimatedDiv style={{ ...springs }}>
        <div ref={boundRef}>
          {/* result content */}
          <CardBody className={`p-3 pb-0 ${hide && 'h-0 p-0'}`}>
            {typeof result === 'string' ? (
              activeResultViewMode === 'markdown' && canPreviewMarkdown ? (
                <MarkdownResult value={result} appFontSize={resolvedAppFontSize} />
              ) : (
                <textarea
                  ref={textAreaRef}
                  className={`text-[${resolvedAppFontSize}px] h-0 w-full resize-none overflow-hidden bg-transparent select-text outline-none`}
                  readOnly
                  value={result}
                />
              )
            ) : (
              <div>
                {result.pronunciations.length > 0 &&
                  result.pronunciations.map((pronunciation) => {
                    const voice = pronunciation.voice
                    return (
                      <div key={nanoid()}>
                        {pronunciation.region && (
                          <span className={`text-[${resolvedAppFontSize}px] mr-3 text-default-500`}>
                            {pronunciation.region}
                          </span>
                        )}
                        {pronunciation.symbol && (
                          <span className={`text-[${resolvedAppFontSize}px] mr-3 text-default-500`}>
                            {pronunciation.symbol}
                          </span>
                        )}
                        {isAudioData(voice) && (
                          <HiOutlineVolumeUp
                            className={`text-[${resolvedAppFontSize}px] inline-block my-auto cursor-pointer`}
                            onClick={() => {
                              void speak(voice).catch((error) => {
                                reportRuntimeError(error, {
                                  source: 'translate.pronunciation.tts',
                                  logMessage: 'Pronunciation audio playback failed.',
                                  toastId: 'translate.pronunciation.tts',
                                  context: {
                                    service: currentTranslateServiceInstanceKey,
                                  },
                                })
                              })
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                {result.explanations.length > 0 &&
                  result.explanations.map((explanations) => {
                    return (
                      <div key={nanoid()}>
                        {explanations.explains.length > 0 &&
                          explanations.explains.map((explain, index) => {
                            return (
                              <span key={nanoid()}>
                                {index === 0 ? (
                                  <>
                                    <span
                                      className={`text-[${resolvedAppFontSize - 2}px] text-default-500 mr-3`}
                                    >
                                      {explanations.trait}
                                    </span>
                                    <span
                                      className={`font-bold text-[${resolvedAppFontSize}px] select-text`}
                                    >
                                      {explain}
                                    </span>
                                    <br />
                                  </>
                                ) : (
                                  <span
                                    className={`text-[${resolvedAppFontSize - 2}px] text-default-500 select-text mr-1`}
                                    key={nanoid()}
                                  >
                                    {explain}
                                  </span>
                                )}
                              </span>
                            )
                          })}
                      </div>
                    )
                  })}
                <br />
                {result.associations.length > 0 &&
                  result.associations.map((association) => {
                    return (
                      <div key={nanoid()}>
                        <span className={`text-[${resolvedAppFontSize}px] text-default-500`}>
                          {association}
                        </span>
                      </div>
                    )
                  })}
                {result.sentence.length > 0 &&
                  result.sentence.map((sentence, index) => {
                    return (
                      <div key={nanoid()}>
                        <span className={`text-[${resolvedAppFontSize - 2}px] mr-3`}>
                          {index + 1}.
                        </span>
                        <>
                          {sentence.source && (
                            <span className={`text-[${resolvedAppFontSize}px] select-text`}>
                              {renderSafeRichText(sentence.source)}
                            </span>
                          )}
                        </>
                        <>
                          {sentence.target && (
                            <div
                              className={`text-[${resolvedAppFontSize}px] select-text text-default-500`}
                            >
                              {renderSafeRichText(sentence.target)}
                            </div>
                          )}
                        </>
                      </div>
                    )
                  })}
              </div>
            )}
            {error !== '' ? (
              error.split('\n').map((v) => {
                return (
                  <p key={v} className={`text-[${resolvedAppFontSize}px] text-red-500`}>
                    {v}
                  </p>
                )
              })
            ) : (
              <></>
            )}
          </CardBody>
          <CardFooter
            className={`bg-content1 rounded-none rounded-b-[10px] flex px-3 p-1.25 ${hide && 'hidden'}`}
          >
            <ButtonGroup>
              {/* markdown preview toggle */}
              <Tooltip
                content={
                  activeResultViewMode === 'markdown'
                    ? t('translate.show_source')
                    : t('translate.show_preview')
                }
              >
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className={`${!canPreviewMarkdown && 'hidden'}`}
                  isDisabled={!canPreviewMarkdown}
                  onPress={() => {
                    setResultViewMode(activeResultViewMode === 'markdown' ? 'source' : 'markdown')
                  }}
                >
                  {activeResultViewMode === 'markdown' ? (
                    <MdCode className="text-[16px]" />
                  ) : (
                    <MdArticle className="text-[16px]" />
                  )}
                </Button>
              </Tooltip>
              {/* speak button */}
              <Tooltip content={t('translate.speak')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  isDisabled={typeof result !== 'string' || result === ''}
                  onPress={() => {
                    handleSpeak().catch((e) => {
                      reportRuntimeError(e, {
                        source: 'translate.target.tts',
                        logMessage: 'Target text TTS failed.',
                        toastId: 'translate.target.tts',
                        context: {
                          service: ttsServiceInstanceKey ?? 'none',
                          targetLanguage,
                        },
                      })
                    })
                  }}
                >
                  <HiOutlineVolumeUp className="text-[16px]" />
                </Button>
              </Tooltip>
              {/* copy button */}
              <Tooltip content={t('translate.copy')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  isDisabled={typeof result !== 'string' || result === ''}
                  onPress={() => {
                    if (typeof result === 'string') {
                      writeText(result)
                    }
                  }}
                >
                  <MdContentCopy className="text-[16px]" />
                </Button>
              </Tooltip>
              {/* translate back button */}
              <Tooltip content={t('translate.translate_back')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  isDisabled={typeof result !== 'string' || result === ''}
                  onPress={async () => {
                    if (typeof result !== 'string') {
                      return
                    }
                    setError('')
                    setResultViewMode(null)
                    let newTargetLanguage = sourceLanguage
                    if (sourceLanguage === 'auto') {
                      newTargetLanguage = detectLanguage
                    }
                    let newSourceLanguage = targetLanguage
                    if (sourceLanguage === 'auto') {
                      newSourceLanguage = 'auto'
                    }
                    if (whetherPluginService(currentTranslateServiceInstanceKey)) {
                      const pluginInfo =
                        pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)]
                      if (!pluginInfo?.language) {
                        setError(getTranslateServiceNotConfiguredMessage())
                        return
                      }
                      if (
                        newSourceLanguage in pluginInfo.language &&
                        newTargetLanguage in pluginInfo.language
                      ) {
                        setIsLoading(true)
                        setHide(true)
                        const instanceConfig =
                          serviceInstanceConfigMap[currentTranslateServiceInstanceKey]
                        if (instanceConfig === undefined) {
                          setIsLoading(false)
                          setError(getTranslateServiceNotConfiguredMessage())
                          return
                        }
                        instanceConfig['enable'] = 'true'
                        const setHideOnce = invokeOnce(setHide)
                        const [func, utils] = await invoke_plugin(
                          'translate',
                          getServiceName(currentTranslateServiceInstanceKey),
                        )
                        func(
                          result.trim(),
                          pluginInfo.language[newSourceLanguage],
                          pluginInfo.language[newTargetLanguage],
                          {
                            config: instanceConfig,
                            detect: detectLanguage,
                            setResult: (v: unknown) => {
                              setResult(toTranslationResult(v))
                              setHideOnce(false)
                            },
                            utils,
                          },
                        ).then(
                          (v) => {
                            const translatedText = toText(v).trim()
                            if (v === result) {
                              setResult(`${translatedText} `)
                            } else {
                              setResult(translatedText)
                            }
                            setIsLoading(false)
                            if (hasVisibleResult(v)) {
                              setHideOnce(false)
                            }
                          },
                          (e: unknown) => {
                            reportRuntimeError(e, {
                              source: 'translate_back.plugin',
                              logMessage: 'Translate-back plugin rejected.',
                              toastId: `translate_back.plugin:${currentTranslateServiceInstanceKey}`,
                              context: {
                                service: currentTranslateServiceInstanceKey,
                                from: newSourceLanguage ?? 'unknown',
                                to: newTargetLanguage ?? 'unknown',
                              },
                            })
                            setError(toErrorMessage(e))
                            setIsLoading(false)
                          },
                        )
                      } else {
                        setError(t('errors.language_not_supported'))
                      }
                    } else {
                      const builtinService =
                        builtinServiceMap[getServiceName(currentTranslateServiceInstanceKey)]
                      if (!builtinService) {
                        setError(getTranslateServiceNotConfiguredMessage())
                        return
                      }
                      const LanguageEnum = builtinService.Language
                      if (newSourceLanguage in LanguageEnum && newTargetLanguage in LanguageEnum) {
                        setIsLoading(true)
                        setHide(true)
                        const instanceConfig =
                          serviceInstanceConfigMap[currentTranslateServiceInstanceKey]
                        if (instanceConfig === undefined) {
                          setIsLoading(false)
                          setError(getTranslateServiceNotConfiguredMessage())
                          return
                        }
                        const setHideOnce = invokeOnce(setHide)
                        builtinService
                          .translate(
                            result.trim(),
                            LanguageEnum[newSourceLanguage],
                            LanguageEnum[newTargetLanguage],
                            {
                              config: instanceConfig,
                              detect: newSourceLanguage,
                              setResult: (v: unknown) => {
                                setResult(toTranslationResult(v))
                                setHideOnce(false)
                              },
                            },
                          )
                          .then(
                            (v) => {
                              const translatedText = toText(v).trim()
                              if (v === result) {
                                setResult(`${translatedText} `)
                              } else {
                                setResult(translatedText)
                              }
                              setIsLoading(false)
                              if (hasVisibleResult(v)) {
                                setHideOnce(false)
                              }
                            },
                            (e: unknown) => {
                              reportRuntimeError(e, {
                                source: 'translate_back.builtin',
                                logMessage: 'Translate-back provider rejected.',
                                toastId: `translate_back.builtin:${currentTranslateServiceInstanceKey}`,
                                context: {
                                  service: currentTranslateServiceInstanceKey,
                                  from: newSourceLanguage ?? 'unknown',
                                  to: newTargetLanguage ?? 'unknown',
                                },
                              })
                              setError(toErrorMessage(e))
                              setIsLoading(false)
                            },
                          )
                      } else {
                        setError(t('errors.language_not_supported'))
                      }
                    }
                  }}
                >
                  <TbTransformFilled className="text-[16px]" />
                </Button>
              </Tooltip>
              {/* error retry button */}
              <Tooltip content={t('translate.retry')}>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className={`${error === '' && 'hidden'}`}
                  onPress={() => {
                    setError('')
                    setResult('')
                    setResultViewMode(null)
                    translate()
                  }}
                >
                  <GiCycle className="text-[16px]" />
                </Button>
              </Tooltip>
            </ButtonGroup>
          </CardFooter>
        </div>
      </AnimatedDiv>
    </Card>
  )
}
