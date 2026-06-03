import {
  Card,
  Button,
  CardFooter,
  Dropdown,
  DropdownMenu,
  DropdownTrigger,
  DropdownItem,
} from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { BiTransferAlt } from 'react-icons/bi'
import React, { useEffect } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'

import { languageList } from '@/renderer/lib/language/language'
import { detectLanguageAtom } from '../SourceArea'
import { useConfig } from '../../../../hooks'

const DropdownMenuAny = DropdownMenu as any

export const sourceLanguageAtom = atom('auto')
export const targetLanguageAtom = atom('zh_cn')

export default function LanguageArea() {
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

  useEffect(() => {
    if (translateSourceLanguage) {
      setSourceLanguage(translateSourceLanguage)
    }
    if (translateTargetLanguage) {
      setTargetLanguage(translateTargetLanguage)
    }
  }, [translateSourceLanguage, translateTargetLanguage, setSourceLanguage, setTargetLanguage])

  useEffect(() => {
    if (rememberLanguage !== null && rememberLanguage) {
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
            <DropdownMenuAny
              aria-label="Source Language"
              className="max-h-[50vh] overflow-y-auto"
              onAction={(key: React.Key) => {
                setSourceLanguage(String(key))
              }}
            >
              <DropdownItem key="auto">{t('languages.auto')}</DropdownItem>
              {languageList.map((x) => {
                return <DropdownItem key={x}>{t(`languages.${x}`)}</DropdownItem>
              })}
            </DropdownMenuAny>
          </Dropdown>
        </div>
        <div className="flex">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="text-[20px]"
            onPress={async () => {
              if (sourceLanguage !== 'auto') {
                const oldSourceLanguage = sourceLanguage
                setSourceLanguage(targetLanguage)
                setTargetLanguage(oldSourceLanguage)
              } else {
                if (detectLanguage !== '') {
                  if (targetLanguage === translateTargetLanguage) {
                    setTargetLanguage(detectLanguage)
                  } else {
                    setTargetLanguage(translateTargetLanguage ?? targetLanguage)
                  }
                } else {
                  if (targetLanguage === translateSecondLanguage) {
                    setTargetLanguage(translateTargetLanguage ?? targetLanguage)
                  } else {
                    setTargetLanguage(translateSecondLanguage ?? targetLanguage)
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
              <Button radius="sm" variant="light">
                {t(`languages.${targetLanguage}`)}
              </Button>
            </DropdownTrigger>
            <DropdownMenuAny
              aria-label="Target Language"
              className="max-h-[50vh] overflow-y-auto"
              onAction={(key: React.Key) => {
                setTargetLanguage(String(key))
              }}
            >
              {languageList.map((x) => {
                return <DropdownItem key={x}>{t(`languages.${x}`)}</DropdownItem>
              })}
            </DropdownMenuAny>
          </Dropdown>
        </div>
      </CardFooter>
    </Card>
  )
}
