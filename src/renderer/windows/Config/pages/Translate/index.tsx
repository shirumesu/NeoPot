import { DropdownTrigger } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Dropdown } from '@heroui/react'
import { Switch } from '@heroui/react'
import { Button } from '@heroui/react'
import { Card } from '@heroui/react'
import React, { useEffect, useState } from 'react'

import { languageList } from '@/renderer/lib/language/language'
import { useConfig } from '../../../../hooks/useConfig'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { useConfigSave } from '../../hooks/useConfigSave'
import { loadInstalledPlugins, type InstalledPlugin } from '../Plugin/installedPlugins'
import { listen } from '@/renderer/lib/electron/compat/event'

const DropdownMenuAny = DropdownMenu as any

export default function Translate() {
  const [sourceLanguage, setSourceLanguage] = useConfig('translate_source_language', 'auto')
  const [targetLanguage, setTargetLanguage] = useConfig('translate_target_language', 'zh_cn')
  const [secondLanguage, setSecondLanguage] = useConfig('translate_second_language', 'en')
  const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine', 'local')
  const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy', 'disable')
  const [incrementalTranslate, setIncrementalTranslate] = useConfig('incremental_translate', false)
  const [dynamicTranslate, setDynamicTranslate] = useConfig('dynamic_translate', false)
  const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline', false)
  const [rememberLanguage, setRememberLanguage] = useConfig('translate_remember_language', false)
  // const [translateFontSize, setTranslateFontSize] = useConfig('translate_font_size', 16);
  const [windowPosition, setWindowPosition] = useConfig('translate_window_position', 'mouse')
  const [rememberWindowSize, setRememberWindowSize] = useConfig(
    'translate_remember_window_size',
    false,
  )
  const [hideSource, setHideSource] = useConfig('hide_source', false)
  const [hideLanguage, setHideLanguage] = useConfig('hide_language', false)
  const [hideWindow, setHideWindow] = useConfig('translate_hide_window', false)
  const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur', true)
  const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top', false)
  const [langDetectPlugins, setLangDetectPlugins] = useState<InstalledPlugin[]>([])
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  useEffect(() => {
    let disposed = false
    const loadLangDetectPlugins = async () => {
      const plugins = (await loadInstalledPlugins('lang_detect')).filter((plugin) => plugin.enabled)
      if (!disposed) {
        setLangDetectPlugins(plugins)
      }
    }

    void loadLangDetectPlugins()
    const unlistenPromise = listen('reload_plugin_list', loadLangDetectPlugins)

    return () => {
      disposed = true
      unlistenPromise.then((unlisten) => {
        unlisten()
      })
    }
  }, [])

  const detectEngineLabel = (engine: string) => {
    if (engine.startsWith('plugin:')) {
      const pluginName = engine.slice('plugin:'.length)
      return (
        langDetectPlugins.find((plugin) => plugin.name === pluginName)?.display ??
        t('config.translate.plugin_missing')
      )
    }

    return t(`config.translate.${engine}`)
  }

  return (
    <>
      <Card className="mb-2.5">
        <CardBody>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.source_language')}</h3>
            {sourceLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${sourceLanguage}`)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="source language"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    saveConfig(
                      'translate_source_language',
                      sourceLanguage,
                      setSourceLanguage,
                      String(key),
                    )
                  }}
                >
                  <DropdownItem key="auto">{t('languages.auto')}</DropdownItem>
                  {languageList.map((item) => {
                    return <DropdownItem key={item}>{t(`languages.${item}`)}</DropdownItem>
                  })}
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.target_language')}</h3>
            {targetLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${targetLanguage}`)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="target language"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    saveConfig(
                      'translate_target_language',
                      targetLanguage,
                      setTargetLanguage,
                      String(key),
                    )
                  }}
                >
                  {languageList.map((item) => {
                    return <DropdownItem key={item}>{t(`languages.${item}`)}</DropdownItem>
                  })}
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.second_language')}</h3>
            {secondLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${secondLanguage}`)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="second language"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    saveConfig(
                      'translate_second_language',
                      secondLanguage,
                      setSecondLanguage,
                      String(key),
                    )
                  }}
                >
                  {languageList.map((item) => {
                    return <DropdownItem key={item}>{t(`languages.${item}`)}</DropdownItem>
                  })}
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.detect_engine')}</h3>
            {detectEngine !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{detectEngineLabel(detectEngine)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="detect engine"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    saveConfig(
                      'translate_detect_engine',
                      detectEngine,
                      setDetectEngine,
                      String(key),
                    )
                  }}
                >
                  <DropdownItem key="local">{t(`config.translate.local`)}</DropdownItem>
                  {langDetectPlugins.map((plugin) => (
                    <DropdownItem key={`plugin:${plugin.name}`}>
                      {plugin.display} [{t('common.plugin')}]
                    </DropdownItem>
                  ))}
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
        </CardBody>
      </Card>
      <Card className="mb-2.5">
        <CardBody>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.auto_copy')}</h3>
            {autoCopy !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.translate.${autoCopy}`)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="auto copy"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    const copyMode = String(key)
                    saveConfig('translate_auto_copy', autoCopy, setAutoCopy, copyMode).then(
                      (saved) => {
                        if (saved) {
                          invoke('update_tray', { language: '', copyMode })
                        }
                      },
                    )
                  }}
                >
                  <DropdownItem key="source">{t('config.translate.source')}</DropdownItem>
                  <DropdownItem key="target">{t('config.translate.target')}</DropdownItem>
                  <DropdownItem key="source_target">
                    {t('config.translate.source_target')}
                  </DropdownItem>
                  <DropdownItem key="disable">{t('config.translate.disable')}</DropdownItem>
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.incremental_translate')}</h3>
            {incrementalTranslate !== null && (
              <Switch
                isSelected={incrementalTranslate}
                onValueChange={(v) => {
                  saveConfig(
                    'incremental_translate',
                    incrementalTranslate,
                    setIncrementalTranslate,
                    v,
                  )
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.dynamic_translate')}</h3>
            {dynamicTranslate !== null && (
              <Switch
                isSelected={dynamicTranslate}
                onValueChange={(v) => {
                  saveConfig('dynamic_translate', dynamicTranslate, setDynamicTranslate, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.delete_newline')}</h3>
            {deleteNewline !== null && (
              <Switch
                isSelected={deleteNewline}
                onValueChange={(v) => {
                  saveConfig('translate_delete_newline', deleteNewline, setDeleteNewline, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.remember_language')}</h3>
            {rememberLanguage !== null && (
              <Switch
                isSelected={rememberLanguage}
                onValueChange={(v) => {
                  saveConfig(
                    'translate_remember_language',
                    rememberLanguage,
                    setRememberLanguage,
                    v,
                  )
                }}
              />
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          {/* <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.font_size.title')}</h3>
                        {translateFontSize !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>
                                        {t(`config.translate.font_size.${translateFontSize}`)}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='window position'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        setTranslateFontSize(key);
                                    }}
                                >
                                    <DropdownItem key={10}>{t(`config.translate.font_size.10`)}</DropdownItem>
                                    <DropdownItem key={12}>{t(`config.translate.font_size.12`)}</DropdownItem>
                                    <DropdownItem key={14}>{t(`config.translate.font_size.14`)}</DropdownItem>
                                    <DropdownItem key={16}>{t(`config.translate.font_size.16`)}</DropdownItem>
                                    <DropdownItem key={18}>{t(`config.translate.font_size.18`)}</DropdownItem>
                                    <DropdownItem key={20}>{t(`config.translate.font_size.20`)}</DropdownItem>
                                    <DropdownItem key={24}>{t(`config.translate.font_size.24`)}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div> */}
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.window_position')}</h3>
            {windowPosition !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.translate.${windowPosition}`)}</Button>
                </DropdownTrigger>
                <DropdownMenuAny
                  aria-label="window position"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    saveConfig(
                      'translate_window_position',
                      windowPosition,
                      setWindowPosition,
                      String(key),
                    )
                  }}
                >
                  <DropdownItem key="mouse">{t('config.translate.mouse')}</DropdownItem>
                  <DropdownItem key="pre_state">{t('config.translate.pre_state')}</DropdownItem>
                </DropdownMenuAny>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.remember_window_size')}</h3>
            {rememberWindowSize !== null && (
              <Switch
                isSelected={rememberWindowSize}
                onValueChange={(v) => {
                  saveConfig(
                    'translate_remember_window_size',
                    rememberWindowSize,
                    setRememberWindowSize,
                    v,
                  )
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.close_on_blur')}</h3>
            {closeOnBlur !== null && (
              <Switch
                isSelected={closeOnBlur}
                onValueChange={(v) => {
                  saveConfig('translate_close_on_blur', closeOnBlur, setCloseOnBlur, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.always_on_top')}</h3>
            {alwaysOnTop !== null && (
              <Switch
                isSelected={alwaysOnTop}
                onValueChange={(v) => {
                  saveConfig('translate_always_on_top', alwaysOnTop, setAlwaysOnTop, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.hide_source')}</h3>
            {hideSource !== null && (
              <Switch
                isSelected={hideSource}
                onValueChange={(v) => {
                  saveConfig('hide_source', hideSource, setHideSource, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.hide_language')}</h3>
            {hideLanguage !== null && (
              <Switch
                isSelected={hideLanguage}
                onValueChange={(v) => {
                  saveConfig('hide_language', hideLanguage, setHideLanguage, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto mx-0">{t('config.translate.hide_window')}</h3>
            {hideWindow !== null && (
              <Switch
                isSelected={hideWindow}
                onValueChange={(v) => {
                  saveConfig('translate_hide_window', hideWindow, setHideWindow, v)
                }}
              />
            )}
          </div>
        </CardBody>
      </Card>
    </>
  )
}
