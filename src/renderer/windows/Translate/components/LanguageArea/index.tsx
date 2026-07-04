import { Card, Button, CardFooter, Dropdown, DropdownTrigger, DropdownItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { BiTransferAlt } from 'react-icons/bi'
import React, { useEffect } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'

import { detectLanguageAtom } from '../SourceArea'
import { useConfig } from '../../../../hooks'
import SafeDropdownMenu from '@/renderer/components/SafeDropdownMenu'
import { ACTION_ICON_CLASS } from '@/renderer/components/uiSize'
import * as builtinTranslateServices from '@/renderer/providers/translate'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import { getSupportedTranslateLanguageList } from '@/renderer/lib/language/translateServiceLanguages'

export const sourceLanguageAtom = atom('auto')
export const targetLanguageAtom = atom('zh_cn')

interface LanguageAreaProps {
  translateServiceInstanceList: string[]
  pluginList: EnabledServicePluginList
}

export default function LanguageArea(props: LanguageAreaProps) {
  const { translateServiceInstanceList, pluginList } = props
  const [rememberLanguage] = useConfig('translate_remember_language', false)
  const [translateSourceLanguage, setTranslateSourceLanguage] = useConfig(
    'translate_source_language',
    'auto',
  )
  const [translateTargetLanguage, setTranslateTargetLanguage] = useConfig(
    'translate_target_language',
    'zh_cn',
  )
  const [translateSecondLanguage] = useConfig('translate_second_language', 'en')

  const [sourceLanguage, setSourceLanguage] = useAtom(sourceLanguageAtom)
  const [targetLanguage, setTargetLanguage] = useAtom(targetLanguageAtom)
  const detectLanguage = useAtomValue(detectLanguageAtom)
  const { t } = useTranslation()
  const supportedLanguageList = React.useMemo(
    () =>
      getSupportedTranslateLanguageList(translateServiceInstanceList, {
        builtinServices: builtinTranslateServices,
        pluginServices: pluginList.translate,
      }),
    [pluginList.translate, translateServiceInstanceList],
  )
  const fallbackTargetLanguage = React.useMemo(
    () => (supportedLanguageList.includes('zh_cn') ? 'zh_cn' : (supportedLanguageList[0] ?? '')),
    [supportedLanguageList],
  )
  const hasSupportedTargetLanguages = supportedLanguageList.length > 0

  const setSupportedTargetLanguage = React.useCallback(
    (language: string | null | undefined) => {
      setTargetLanguage(
        language && supportedLanguageList.includes(language) ? language : fallbackTargetLanguage,
      )
    },
    [fallbackTargetLanguage, setTargetLanguage, supportedLanguageList],
  )

  useEffect(() => {
    if (
      translateSourceLanguage &&
      (translateSourceLanguage === 'auto' ||
        supportedLanguageList.includes(translateSourceLanguage))
    ) {
      setSourceLanguage(translateSourceLanguage)
    }
    if (translateTargetLanguage) {
      setSupportedTargetLanguage(translateTargetLanguage)
    }
  }, [
    translateSourceLanguage,
    translateTargetLanguage,
    setSourceLanguage,
    setSupportedTargetLanguage,
    supportedLanguageList,
  ])

  useEffect(() => {
    if (sourceLanguage !== 'auto' && !supportedLanguageList.includes(sourceLanguage)) {
      setSourceLanguage('auto')
    }
    if (!supportedLanguageList.includes(targetLanguage)) {
      setTargetLanguage(fallbackTargetLanguage)
    }
  }, [
    fallbackTargetLanguage,
    setSourceLanguage,
    setTargetLanguage,
    sourceLanguage,
    supportedLanguageList,
    targetLanguage,
  ])

  useEffect(() => {
    if (rememberLanguage !== null && rememberLanguage && targetLanguage) {
      setTranslateSourceLanguage(sourceLanguage)
      setTranslateTargetLanguage(targetLanguage)
    }
  }, [
    sourceLanguage,
    targetLanguage,
    rememberLanguage,
    setTranslateSourceLanguage,
    setTranslateTargetLanguage,
  ])

  return (
    <Card shadow="none" className="bg-content2 h-8.75 rounded-[10px]">
      <CardFooter className="bg-content2 flex justify-between p-0 rounded-[10px]">
        <div className="flex">
          <Dropdown>
            <DropdownTrigger>
              <Button radius="sm" variant="light">
                {t(`languages.${sourceLanguage}`)}
              </Button>
            </DropdownTrigger>
            <SafeDropdownMenu
              aria-label={t('accessibility.source_language')}
              className="max-h-[50vh] overflow-y-auto"
              onAction={(key: React.Key) => {
                setSourceLanguage(String(key))
              }}
            >
              <DropdownItem key="auto">{t('languages.auto')}</DropdownItem>
              {supportedLanguageList.map((x) => {
                return <DropdownItem key={x}>{t(`languages.${x}`)}</DropdownItem>
              })}
            </SafeDropdownMenu>
          </Dropdown>
        </div>
        <div className="flex">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className={ACTION_ICON_CLASS}
            isDisabled={!hasSupportedTargetLanguages}
            onPress={async () => {
              if (sourceLanguage !== 'auto') {
                const oldSourceLanguage = sourceLanguage
                setSourceLanguage(targetLanguage)
                setTargetLanguage(oldSourceLanguage)
              } else {
                if (detectLanguage !== '') {
                  if (targetLanguage === translateTargetLanguage) {
                    setSupportedTargetLanguage(detectLanguage)
                  } else {
                    setSupportedTargetLanguage(translateTargetLanguage ?? targetLanguage)
                  }
                } else {
                  if (targetLanguage === translateSecondLanguage) {
                    setSupportedTargetLanguage(translateTargetLanguage ?? targetLanguage)
                  } else {
                    setSupportedTargetLanguage(translateSecondLanguage ?? targetLanguage)
                  }
                }
              }
            }}
          >
            <BiTransferAlt />
          </Button>
        </div>
        <div className="flex">
          <Dropdown>
            <DropdownTrigger>
              <Button radius="sm" variant="light" isDisabled={!hasSupportedTargetLanguages}>
                {targetLanguage
                  ? t(`languages.${targetLanguage}`)
                  : t('errors.language_not_supported')}
              </Button>
            </DropdownTrigger>
            <SafeDropdownMenu
              aria-label={t('accessibility.target_language')}
              className="max-h-[50vh] overflow-y-auto"
              onAction={(key: React.Key) => {
                setTargetLanguage(String(key))
              }}
            >
              {supportedLanguageList.map((x) => {
                return <DropdownItem key={x}>{t(`languages.${x}`)}</DropdownItem>
              })}
            </SafeDropdownMenu>
          </Dropdown>
        </div>
      </CardFooter>
    </Card>
  )
}
