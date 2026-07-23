import { DropdownTrigger } from '@heroui/react'
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
import { invokeCommand } from '@/renderer/lib/electron/command'
import { useConfigSave } from '../../hooks/useConfigSave'
import { loadInstalledPlugins, type InstalledPlugin } from '../Plugin/installedPlugins'
import { onAppEvent } from '@/renderer/lib/electron/events'
import SafeDropdownMenu from '@/renderer/components/SafeDropdownMenu'
import ConfigItem from '../../components/ConfigItem'

export default function Translate() {
  const [sourceLanguage, setSourceLanguage] = useConfig('translate_source_language', 'auto')
  const [targetLanguage, setTargetLanguage] = useConfig('translate_target_language', 'zh_cn')
  const [secondLanguage, setSecondLanguage] = useConfig('translate_second_language', 'en')
  const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine', 'local')
  const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy', 'disable')
  const [incrementalTranslate, setIncrementalTranslate] = useConfig('incremental_translate', false)
  const [dynamicTranslate, setDynamicTranslate] = useConfig('dynamic_translate', false)
  const [clipboardMonitor, setClipboardMonitor] = useConfig('clipboard_monitor', false)
  const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline', false)
  const [rememberLanguage, setRememberLanguage] = useConfig('translate_remember_language', false)
  const [windowPosition, setWindowPosition] = useConfig('translate_window_position', 'mouse')
  const [adaptiveWindowSize, setAdaptiveWindowSize] = useConfig(
    'translate_adaptive_window_size',
    false,
  )
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
    const unlisten = onAppEvent('reload_plugin_list', loadLangDetectPlugins)

    return () => {
      disposed = true
      unlisten()
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

    return t('config.translate.local')
  }

  return (
    <>
      <Card className="mb-2.5">
        <CardBody>
          <ConfigItem title={t('config.translate.source_language')}>
            {sourceLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${sourceLanguage}`)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.source_language')}
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.target_language')}>
            {targetLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${targetLanguage}`)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.target_language')}
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.second_language')}>
            {secondLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`languages.${secondLanguage}`)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.second_language')}
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.detect_engine')}>
            {detectEngine !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{detectEngineLabel(detectEngine)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.detect_engine')}
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
        </CardBody>
      </Card>
      <Card className="mb-2.5">
        <CardBody>
          <ConfigItem title={t('config.translate.auto_copy')}>
            {autoCopy !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.translate.${autoCopy}`)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.auto_copy')}
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key: React.Key) => {
                    const copyMode = String(key)
                    saveConfig('translate_auto_copy', autoCopy, setAutoCopy, copyMode).then(
                      (saved) => {
                        if (saved) {
                          invokeCommand('update_tray', { language: '', copyMode })
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.incremental_translate')}>
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
          </ConfigItem>
          <ConfigItem title={t('config.translate.dynamic_translate')}>
            {dynamicTranslate !== null && (
              <Switch
                isSelected={dynamicTranslate}
                onValueChange={(v) => {
                  saveConfig('dynamic_translate', dynamicTranslate, setDynamicTranslate, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.general.clipboard_monitor')}>
            {clipboardMonitor !== null && (
              <Switch
                isSelected={clipboardMonitor}
                onValueChange={async (v) => {
                  const saved = await saveConfig(
                    'clipboard_monitor',
                    clipboardMonitor,
                    setClipboardMonitor,
                    v,
                  )
                  if (saved) {
                    await invokeCommand('set_clipboard_monitor', { enabled: v })
                  }
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.delete_newline')}>
            {deleteNewline !== null && (
              <Switch
                isSelected={deleteNewline}
                onValueChange={(v) => {
                  saveConfig('translate_delete_newline', deleteNewline, setDeleteNewline, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.remember_language')}>
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
          </ConfigItem>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <ConfigItem title={t('config.translate.window_position')}>
            {windowPosition !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.translate.${windowPosition}`)}</Button>
                </DropdownTrigger>
                <SafeDropdownMenu
                  aria-label={t('accessibility.window_position')}
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
                </SafeDropdownMenu>
              </Dropdown>
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.adaptive_window_size')}>
            {adaptiveWindowSize !== null && (
              <Switch
                isSelected={adaptiveWindowSize}
                onValueChange={async (v) => {
                  if (v && rememberWindowSize) {
                    const disabledRememberWindowSize = await saveConfig(
                      'translate_remember_window_size',
                      rememberWindowSize,
                      setRememberWindowSize,
                      false,
                      { notify: false },
                    )
                    if (!disabledRememberWindowSize) {
                      return
                    }
                  }
                  await saveConfig(
                    'translate_adaptive_window_size',
                    adaptiveWindowSize,
                    setAdaptiveWindowSize,
                    v,
                  )
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.remember_window_size')}>
            {rememberWindowSize !== null && (
              <Switch
                isSelected={rememberWindowSize}
                onValueChange={async (v) => {
                  if (v && adaptiveWindowSize) {
                    const disabledAdaptiveWindowSize = await saveConfig(
                      'translate_adaptive_window_size',
                      adaptiveWindowSize,
                      setAdaptiveWindowSize,
                      false,
                      { notify: false },
                    )
                    if (!disabledAdaptiveWindowSize) {
                      return
                    }
                  }
                  await saveConfig(
                    'translate_remember_window_size',
                    rememberWindowSize,
                    setRememberWindowSize,
                    v,
                  )
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.close_on_blur')}>
            {closeOnBlur !== null && (
              <Switch
                isSelected={closeOnBlur}
                onValueChange={(v) => {
                  saveConfig('translate_close_on_blur', closeOnBlur, setCloseOnBlur, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.always_on_top')}>
            {alwaysOnTop !== null && (
              <Switch
                isSelected={alwaysOnTop}
                onValueChange={(v) => {
                  saveConfig('translate_always_on_top', alwaysOnTop, setAlwaysOnTop, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.hide_source')}>
            {hideSource !== null && (
              <Switch
                isSelected={hideSource}
                onValueChange={(v) => {
                  saveConfig('hide_source', hideSource, setHideSource, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.hide_language')}>
            {hideLanguage !== null && (
              <Switch
                isSelected={hideLanguage}
                onValueChange={(v) => {
                  saveConfig('hide_language', hideLanguage, setHideLanguage, v)
                }}
              />
            )}
          </ConfigItem>
          <ConfigItem title={t('config.translate.hide_window')}>
            {hideWindow !== null && (
              <Switch
                isSelected={hideWindow}
                onValueChange={(v) => {
                  saveConfig('translate_hide_window', hideWindow, setHideWindow, v)
                }}
              />
            )}
          </ConfigItem>
        </CardBody>
      </Card>
    </>
  )
}
