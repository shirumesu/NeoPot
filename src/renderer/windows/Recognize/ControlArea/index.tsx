import { Dropdown, DropdownItem, DropdownTrigger, Button } from '@heroui/react'
import { atom, useAtom, useSetAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { HiTranslate } from 'react-icons/hi'
import { GiCycle } from 'react-icons/gi'
import React, { useEffect } from 'react'
import * as builtinService from '@/renderer/providers/recognize'
import type { RecognizeProvider } from '@/renderer/providers/recognize'
import { languageList } from '@/renderer/lib/language/language'
import { invokeCommand } from '@/renderer/lib/electron/command'
import { useConfig } from '../../../hooks'
import { textAtom } from '../TextArea'
import { pluginListAtom } from '..'
import SafeDropdownMenu from '@/renderer/components/SafeDropdownMenu'
import ServiceInstanceDropdown from '@/renderer/components/ServiceInstanceDropdown'
import type { ServiceInstanceConfigMap } from '@/renderer/lib/service/serviceConfig'
import { CONTROL_ICON_CLASS } from '@/renderer/components/uiSize'

export const currentServiceInstanceKeyAtom = atom('')
export const languageAtom = atom('auto')
export const recognizeFlagAtom = atom('')

interface ControlAreaProps {
  serviceInstanceConfigMap: ServiceInstanceConfigMap
  serviceInstanceList: string[]
}

export default function ControlArea(props: ControlAreaProps) {
  const { serviceInstanceConfigMap, serviceInstanceList } = props
  const pluginList = useAtomValue(pluginListAtom)
  const builtinServiceMap: Record<string, RecognizeProvider> = builtinService
  const [recognizeLanguage] = useConfig('recognize_language', 'auto')
  const setRecognizeFlag = useSetAtom(recognizeFlagAtom)
  const [currentServiceInstanceKey, setCurrentServiceInstanceKey] = useAtom(
    currentServiceInstanceKeyAtom,
  )
  const [language, setLanguage] = useAtom(languageAtom)
  const text = useAtomValue(textAtom)
  const { t } = useTranslation()

  useEffect(() => {
    if (serviceInstanceList) {
      setCurrentServiceInstanceKey(serviceInstanceList[0])
    }
    if (recognizeLanguage) {
      setLanguage(recognizeLanguage)
    }
  }, [serviceInstanceList, recognizeLanguage, setCurrentServiceInstanceKey, setLanguage])

  return (
    <div className="flex justify-between px-3 h-full">
      {currentServiceInstanceKey && (
        <ServiceInstanceDropdown
          selectedKey={currentServiceInstanceKey}
          instanceKeys={serviceInstanceList}
          serviceInstanceConfigMap={serviceInstanceConfigMap}
          pluginServices={pluginList}
          builtinServices={builtinServiceMap}
          getBuiltinLabel={(serviceName) => t(`services.recognize.${serviceName}.title`)}
          ariaLabel={t('accessibility.recognize_service')}
          onSelectionChange={setCurrentServiceInstanceKey}
          buttonClassName="my-auto"
          iconClassName={`${CONTROL_ICON_CLASS} my-auto`}
        />
      )}
      {language && (
        <Dropdown>
          <DropdownTrigger>
            <Button className="my-auto" variant="bordered" size="sm">
              {t(`languages.${language}`)}
            </Button>
          </DropdownTrigger>
          <SafeDropdownMenu
            aria-label={t('accessibility.recognize_language')}
            className="max-h-[70vh] overflow-y-auto"
            onAction={(key: React.Key) => {
              setLanguage(String(key))
            }}
          >
            <DropdownItem key="auto">{t('languages.auto')}</DropdownItem>
            {languageList.map((name) => {
              return <DropdownItem key={name}>{t(`languages.${name}`)}</DropdownItem>
            })}
          </SafeDropdownMenu>
        </Dropdown>
      )}
      <Button
        variant="flat"
        color="secondary"
        size="sm"
        className="my-auto"
        startContent={<GiCycle className={CONTROL_ICON_CLASS} />}
        onPress={() => {
          setRecognizeFlag(crypto.randomUUID())
        }}
      >
        {t('recognize.recognize')}
      </Button>
      <Button
        variant="flat"
        color="primary"
        size="sm"
        className="my-auto"
        startContent={<HiTranslate className={CONTROL_ICON_CLASS} />}
        onPress={async () => {
          if (text) {
            await invokeCommand('translate_text', { text })
          }
        }}
      >
        {t('recognize.translate')}
      </Button>
    </div>
  )
}
