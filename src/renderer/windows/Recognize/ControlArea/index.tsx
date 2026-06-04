import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Button } from '@heroui/react'
import { atom, useAtom, useSetAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { HiTranslate } from 'react-icons/hi'
import { GiCycle } from 'react-icons/gi'
import React, { useEffect } from 'react'
import { nanoid } from 'nanoid'
import * as builtinService from '@/renderer/providers/recognize'
import { languageList } from '@/renderer/lib/language/language'
import { electronCommand } from '@/renderer/lib/electron/command'
import { useConfig } from '../../../hooks'
import { textAtom } from '../TextArea'
import { pluginListAtom } from '..'
import {
  ServiceSourceType,
  getServiceSouceType,
  getServiceName,
  INSTANCE_NAME_CONFIG_KEY,
  getDisplayInstanceName,
} from '@/renderer/lib/service/service_instance'

const DropdownMenuAny = DropdownMenu as any

export const currentServiceInstanceKeyAtom = atom('')
export const languageAtom = atom('auto')
export const recognizeFlagAtom = atom('')

export default function ControlArea(props: any) {
  const { serviceInstanceConfigMap, serviceInstanceList } = props
  const pluginList = useAtomValue(pluginListAtom)
  const builtinServiceMap = builtinService as Record<string, any>
  const [recognizeLanguage] = useConfig('recognize_language', 'auto')
  const setRecognizeFlag = useSetAtom(recognizeFlagAtom)
  const [currentServiceInstanceKey, setCurrentServiceInstanceKey] = useAtom(
    currentServiceInstanceKeyAtom,
  )
  const [language, setLanguage] = useAtom(languageAtom)
  const text = useAtomValue(textAtom)
  const { t } = useTranslation()

  function getInstanceName(instanceKey: string, serviceNameSupplier: () => string) {
    const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {}
    return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier)
  }

  useEffect(() => {
    if (serviceInstanceList) {
      setCurrentServiceInstanceKey(serviceInstanceList[0])
    }
    if (recognizeLanguage) {
      setLanguage(recognizeLanguage)
    }
  }, [serviceInstanceList, recognizeLanguage, setCurrentServiceInstanceKey, setLanguage])

  return (
    <div className="flex justify-between px-[12px] h-full">
      {currentServiceInstanceKey && (
        <Dropdown>
          <DropdownTrigger>
            <Button
              className="my-auto"
              variant="bordered"
              size="sm"
              startContent={
                <img
                  className="h-[16px] w-[16px] my-auto"
                  src={
                    getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                      ? pluginList[getServiceName(currentServiceInstanceKey)].icon
                      : builtinServiceMap[getServiceName(currentServiceInstanceKey)].info.icon
                  }
                />
              }
            >
              {getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                ? getInstanceName(
                    currentServiceInstanceKey,
                    () => pluginList[getServiceName(currentServiceInstanceKey)].display,
                  )
                : getInstanceName(currentServiceInstanceKey, () =>
                    t(`services.recognize.${currentServiceInstanceKey}.title`),
                  )}
            </Button>
          </DropdownTrigger>
          <DropdownMenuAny
            aria-label={t('accessibility.recognize_service')}
            className="max-h-[70vh] overflow-y-auto"
            onAction={(key: React.Key) => {
              setCurrentServiceInstanceKey(String(key))
            }}
          >
            {serviceInstanceList.map((instanceKey: string) => {
              return (
                <DropdownItem
                  key={instanceKey}
                  startContent={
                    <img
                      className="h-[16px] w-[16px] my-auto"
                      src={
                        getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                          ? pluginList[getServiceName(instanceKey)].icon
                          : builtinServiceMap[getServiceName(instanceKey)].info.icon
                      }
                    />
                  }
                >
                  {getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                    ? getInstanceName(
                        instanceKey,
                        () => pluginList[getServiceName(instanceKey)].display,
                      )
                    : getInstanceName(instanceKey, () =>
                        t(`services.recognize.${instanceKey}.title`),
                      )}
                </DropdownItem>
              )
            })}
          </DropdownMenuAny>
        </Dropdown>
      )}
      {language && (
        <Dropdown>
          <DropdownTrigger>
            <Button className="my-auto" variant="bordered" size="sm">
              {t(`languages.${language}`)}
            </Button>
          </DropdownTrigger>
          <DropdownMenuAny
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
          </DropdownMenuAny>
        </Dropdown>
      )}
      <Button
        variant="flat"
        color="secondary"
        size="sm"
        className="my-auto"
        startContent={<GiCycle className="text-[16px]" />}
        onPress={() => {
          setRecognizeFlag(nanoid())
        }}
      >
        {t('recognize.recognize')}
      </Button>
      <Button
        variant="flat"
        color="primary"
        size="sm"
        className="my-auto"
        startContent={<HiTranslate className="text-[16px]" />}
        onPress={async () => {
          if (text) {
            await electronCommand('translate_text', { text })
          }
        }}
      >
        {t('recognize.translate')}
      </Button>
    </div>
  )
}
