import { enable, isEnabled, disable } from '@/renderer/lib/electron/compat/autostart'
import { DropdownTrigger } from '@heroui/react'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Dropdown } from '@heroui/react'
import { Button } from '@heroui/react'
import { Switch } from '@heroui/react'
import 'flag-icons/css/flag-icons.min.css'
import { Input } from '@heroui/react'
import { Card } from '@heroui/react'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { useTheme } from 'next-themes'
import { applyRendererLogLevel } from '@/renderer/lib/electron/logLevel'
import { isLogLevel, type AppLogLevel } from '@/shared/logLevel'

import { useConfig } from '../../../../hooks/useConfig'
import { LanguageFlag } from '@/renderer/lib/language/language'
import { selectableAppLanguages } from '@/renderer/i18n/resources'
import { useToastStyle } from '../../../../hooks'
import { osType } from '@/renderer/lib/config/env'
import { logger } from '@/renderer/lib/logger'
import { useConfigSave } from '../../hooks/useConfigSave'

const normalizeProxyHost = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return { host: '', port: '' }

  try {
    const url = new URL(trimmed.match(/^https?:\/\//i) ? trimmed : `http://${trimmed}`)
    return {
      host: url.hostname,
      port: url.port,
    }
  } catch {
    const [host, port = ''] = trimmed.replace(/^https?:\/\//i, '').split(':')
    return { host, port }
  }
}

const shouldSplitProxyHostInput = (value: string) => {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) || /^[^:]+:\d+$/.test(trimmed)
}

const isValidProxyPort = (value: string) => {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port <= 65535
}

const SERVER_PORT_MIN = 1
const SERVER_PORT_MAX = 65535

function getLanguageFlag(language: string) {
  return (LanguageFlag as Record<string, string>)[language] ?? 'un'
}

const parseServerPortInput = (value: string) => {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }

  const port = Number(trimmed)
  if (!Number.isSafeInteger(port) || port < SERVER_PORT_MIN || port > SERVER_PORT_MAX) {
    return null
  }

  return port
}

function ServerPortInput() {
  const [serverPort, setServerPort] = useConfig('server_port', 60828, { sync: false })
  const [draftPort, setDraftPort] = useState('')
  const [showPortError, setShowPortError] = useState(false)
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()

  useEffect(() => {
    if (serverPort !== null) {
      setDraftPort(String(serverPort))
      setShowPortError(false)
    }
  }, [serverPort])

  if (serverPort === null) {
    return null
  }

  return (
    <Input
      type="number"
      variant="bordered"
      value={draftPort}
      labelPlacement="outside-left"
      onValueChange={(v) => {
        setDraftPort(v)
        setShowPortError(v !== '' && parseServerPortInput(v) === null)
      }}
      onBlur={() => {
        const nextPort = parseServerPortInput(draftPort)
        if (nextPort === null) {
          setShowPortError(true)
          return
        }

        setDraftPort(String(nextPort))
        setShowPortError(false)
        void saveConfig('server_port', serverPort, setServerPort, nextPort, {
          successMessage: t('config.general.server_port_change'),
        })
      }}
      className="max-w-25"
      isInvalid={showPortError}
      errorMessage={showPortError ? t('config.general.invalid_port') : undefined}
      classNames={{
        input:
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
      }}
    />
  )
}

export default function General() {
  const [autoStart, setAutoStart] = useState(false)
  const [fontList, setFontList] = useState<string[] | null>(null)
  const [checkUpdate, setCheckUpdate] = useConfig('check_update', true)
  const [closeToTray, setCloseToTray] = useConfig('close_to_tray', true)
  const [appLanguage, setAppLanguage] = useConfig('app_language', 'en')
  const [appTheme, setAppTheme] = useConfig('app_theme', 'system')
  const [appFont, setAppFont] = useConfig('app_font', 'default')
  const [appFallbackFont, setAppFallbackFont] = useConfig('app_fallback_font', 'default')
  const [appFontSize, setAppFontSize] = useConfig('app_font_size', 16)
  const [devMode, setDevMode] = useConfig('dev_mode', false)
  const [logLevel, setLogLevel] = useConfig<AppLogLevel>('log_level', 'info')
  const [trayClickEvent, setTrayClickEvent] = useConfig('tray_click_event', 'config')
  const [proxyEnable, setProxyEnable] = useConfig('proxy_enable', false)
  const [proxyHost, setProxyHost] = useConfig('proxy_host', '')
  const [proxyPort, setProxyPort] = useConfig('proxy_port', '')
  const [proxyUsername, setProxyUsername] = useConfig('proxy_username', '')
  const [proxyPassword, setProxyPassword] = useConfig('proxy_password', '')
  const [noProxy, setNoProxy] = useConfig('no_proxy', 'localhost,127.0.0.1')
  const { t, i18n } = useTranslation()
  const { setTheme } = useTheme()
  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  const appLanguageName = (language: string) =>
    t(`app_languages.${language}`, {
      defaultValue: t(`languages.${language}`, { defaultValue: language }),
    })

  useEffect(() => {
    isEnabled().then((v) => {
      setAutoStart(v)
    })
    invoke<string[]>('font_list').then((v) => {
      setFontList(v)
    })
  }, [])

  return (
    <>
      <Card className="mb-2.5">
        <CardBody>
          <div className="config-item">
            <h3>{t('config.general.auto_start')}</h3>
            <Switch
              isSelected={autoStart}
              onValueChange={async (v) => {
                if (autoStart === v) {
                  return
                }
                setAutoStart(v)
                try {
                  if (v) {
                    await enable()
                    logger.info('Auto start enabled.')
                  } else {
                    await disable()
                    logger.info('Auto start disabled.')
                  }
                  const verified = await isEnabled()
                  if (verified !== v) {
                    throw new Error('Auto start state did not change')
                  }
                  logger.debug('Auto start state verified.', {
                    enabled: v,
                  })
                  toast.success(t('config.common.save_success'), {
                    duration: 1500,
                    style: toastStyle,
                  })
                } catch (error) {
                  logger.error('Auto start setting change failed.', error, {
                    enabled: v,
                  })
                  setAutoStart(!v)
                  toast.error(t('config.common.save_failed'), {
                    duration: 3000,
                    style: toastStyle,
                  })
                }
              }}
            />
          </div>
          <div className="config-item">
            <h3>{t('config.general.check_update')}</h3>
            {checkUpdate !== null && (
              <Switch
                isSelected={checkUpdate}
                onValueChange={(v) => {
                  saveConfig('check_update', checkUpdate, setCheckUpdate, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.close_to_tray')}</h3>
            {closeToTray !== null && (
              <Switch
                isSelected={closeToTray}
                onValueChange={(v) => {
                  saveConfig('close_to_tray', closeToTray, setCloseToTray, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.server_port')}</h3>
            <ServerPortInput />
          </div>
        </CardBody>
      </Card>
      <Card className="mb-2.5">
        <CardBody>
          <div className="config-item">
            <h3>{t('config.general.app_language')}</h3>
            {appLanguage !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="bordered"
                    startContent={<span className={`fi fi-${getLanguageFlag(appLanguage)}`} />}
                  >
                    {appLanguageName(appLanguage)}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.app_language')}
                  className="max-h-[40vh] overflow-y-auto"
                  onAction={(key) => {
                    const language = String(key)
                    saveConfig('app_language', appLanguage, setAppLanguage, language)
                    i18n.changeLanguage(language)
                    invoke('update_tray', { language, copyMode: '' })
                  }}
                >
                  {selectableAppLanguages.map((language) => (
                    <DropdownItem
                      key={language}
                      startContent={<span className={`fi fi-${getLanguageFlag(language)}`} />}
                    >
                      {appLanguageName(language)}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.app_theme')}</h3>
            {appTheme !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.general.theme.${appTheme}`)}</Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.app_theme')}
                  onAction={(key) => {
                    const theme = String(key)
                    saveConfig('app_theme', appTheme, setAppTheme, theme)
                    if (theme !== 'system') {
                      setTheme(theme)
                    } else {
                      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        setTheme('dark')
                      } else {
                        setTheme('light')
                      }
                      window
                        .matchMedia('(prefers-color-scheme: dark)')
                        .addEventListener('change', (e) => {
                          if (e.matches) {
                            setTheme('dark')
                          } else {
                            setTheme('light')
                          }
                        })
                    }
                  }}
                >
                  <DropdownItem key="system">{t('config.general.theme.system')}</DropdownItem>
                  <DropdownItem key="light">{t('config.general.theme.light')}</DropdownItem>
                  <DropdownItem key="dark">{t('config.general.theme.dark')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.app_font')}</h3>
            {appFont !== null && fontList !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="bordered"
                    style={{
                      fontFamily: appFont === 'default' ? 'sans-serif' : appFont,
                    }}
                  >
                    {appFont === 'default' ? t('config.general.default_font') : appFont}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.app_font')}
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key) => {
                    const font = String(key)
                    document.documentElement.style.fontFamily = `"${
                      font === 'default' ? 'sans-serif' : font
                    }","${appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont}"`
                    saveConfig('app_font', appFont, setAppFont, font)
                  }}
                >
                  <DropdownItem style={{ fontFamily: 'sans-serif' }} key="default">
                    {t('config.general.default_font')}
                  </DropdownItem>
                  {
                    fontList.map((x: string) => {
                      return (
                        <DropdownItem style={{ fontFamily: x }} key={x}>
                          {x}
                        </DropdownItem>
                      )
                    }) as any
                  }
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.app_fallback_font')}</h3>
            {appFallbackFont !== null && fontList !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="bordered"
                    style={{
                      fontFamily: appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont,
                    }}
                  >
                    {appFallbackFont === 'default'
                      ? t('config.general.default_font')
                      : appFallbackFont}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.app_fallback_font')}
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key) => {
                    const fallbackFont = String(key)
                    document.documentElement.style.fontFamily = `"${
                      appFont === 'default' ? 'sans-serif' : appFont
                    }","${fallbackFont === 'default' ? 'sans-serif' : fallbackFont}"`
                    saveConfig(
                      'app_fallback_font',
                      appFallbackFont,
                      setAppFallbackFont,
                      fallbackFont,
                    )
                  }}
                >
                  <DropdownItem style={{ fontFamily: 'sans-serif' }} key="default">
                    {t('config.general.default_font')}
                  </DropdownItem>
                  {
                    fontList.map((x: string) => {
                      return (
                        <DropdownItem style={{ fontFamily: x }} key={x}>
                          {x}
                        </DropdownItem>
                      )
                    }) as any
                  }
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.font_size.title')}</h3>
            {appFontSize !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.general.font_size.${appFontSize}`)}</Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.font_size')}
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key) => {
                    document.documentElement.style.fontSize = `${key}px`
                    saveConfig('app_font_size', appFontSize, setAppFontSize, Number(key))
                  }}
                >
                  <DropdownItem key={10}>{t(`config.general.font_size.10`)}</DropdownItem>
                  <DropdownItem key={12}>{t(`config.general.font_size.12`)}</DropdownItem>
                  <DropdownItem key={14}>{t(`config.general.font_size.14`)}</DropdownItem>
                  <DropdownItem key={16}>{t(`config.general.font_size.16`)}</DropdownItem>
                  <DropdownItem key={18}>{t(`config.general.font_size.18`)}</DropdownItem>
                  <DropdownItem key={20}>{t(`config.general.font_size.20`)}</DropdownItem>
                  <DropdownItem key={24}>{t(`config.general.font_size.24`)}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className={`config-item ${osType !== 'Windows_NT' && 'hidden'}`}>
            <h3>{t('config.general.tray_click_event')}</h3>
            {trayClickEvent !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.general.event.${trayClickEvent}`)}</Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.tray_click_event')}
                  onAction={(key) => {
                    saveConfig('tray_click_event', trayClickEvent, setTrayClickEvent, String(key))
                  }}
                >
                  <DropdownItem key="config">{t('config.general.event.config')}</DropdownItem>
                  <DropdownItem key="translate">{t('config.general.event.translate')}</DropdownItem>
                  <DropdownItem key="ocr_recognize">
                    {t('config.general.event.ocr_recognize')}
                  </DropdownItem>
                  <DropdownItem key="ocr_translate">
                    {t('config.general.event.ocr_translate')}
                  </DropdownItem>
                  <DropdownItem key="disable">{t('config.general.event.disable')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.dev_mode')}</h3>
            {devMode !== null && (
              <Switch
                isSelected={devMode}
                onValueChange={(v) => {
                  saveConfig('dev_mode', devMode, setDevMode, v)
                }}
              />
            )}
          </div>
          <div className="config-item">
            <h3>{t('config.general.log_level')}</h3>
            {logLevel !== null && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{t(`config.general.log_levels.${logLevel}`)}</Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={t('accessibility.log_level')}
                  onAction={async (key) => {
                    const nextLevel = String(key)
                    if (!isLogLevel(nextLevel)) {
                      return
                    }

                    const saved = await saveConfig('log_level', logLevel, setLogLevel, nextLevel)
                    if (!saved) {
                      return
                    }

                    applyRendererLogLevel(nextLevel)
                    const applied = await invoke<boolean>('log:set-level', { level: nextLevel })
                    if (applied !== true) {
                      await setLogLevel(logLevel, true)
                      applyRendererLogLevel(logLevel)
                      toast.error(t('config.common.save_failed'), {
                        duration: 3000,
                        style: toastStyle,
                      })
                    }
                  }}
                >
                  <DropdownItem key="debug">{t('config.general.log_levels.debug')}</DropdownItem>
                  <DropdownItem key="info">{t('config.general.log_levels.info')}</DropdownItem>
                  <DropdownItem key="warn">{t('config.general.log_levels.warn')}</DropdownItem>
                  <DropdownItem key="error">{t('config.general.log_levels.error')}</DropdownItem>
                  <DropdownItem key="silent">{t('config.general.log_levels.silent')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <h3>{t('config.general.proxy.title')}</h3>
            {proxyEnable !== null && (
              <Switch
                isSelected={proxyEnable}
                onValueChange={async (v) => {
                  if (v) {
                    if (
                      proxyHost === null ||
                      proxyPort === null ||
                      proxyHost.trim() === '' ||
                      !isValidProxyPort(proxyPort)
                    ) {
                      toast.error(t('config.general.proxy_error'), {
                        duration: 3000,
                        style: toastStyle,
                      })
                      return
                    }
                  }

                  const saved = await saveConfig('proxy_enable', proxyEnable, setProxyEnable, v, {
                    notify: false,
                  })
                  if (!saved) {
                    return
                  }

                  try {
                    await invoke(v ? 'set_proxy' : 'unset_proxy')
                    toast.success(t('config.general.proxy_change'), {
                      duration: 1000,
                      style: toastStyle,
                    })
                  } catch (e) {
                    await saveConfig('proxy_enable', v, setProxyEnable, !v, {
                      notify: false,
                    })
                    try {
                      await invoke(v ? 'unset_proxy' : 'set_proxy')
                    } catch (rollbackError) {
                      logger.error('Proxy rollback failed.', rollbackError)
                    }
                    toast.error(String(e), {
                      duration: 3000,
                      style: toastStyle,
                    })
                  }
                }}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {proxyHost !== null && (
              <Input
                type="text"
                variant="bordered"
                isRequired
                label={t('config.general.proxy.host')}
                placeholder="127.0.0.1"
                value={proxyHost}
                onValueChange={(v) => {
                  if (shouldSplitProxyHostInput(v)) {
                    const { host, port } = normalizeProxyHost(v)
                    setProxyHost(host)
                    if (port !== '') {
                      setProxyPort(port)
                    }
                  } else {
                    setProxyHost(v)
                  }
                }}
              />
            )}
            {proxyPort !== null && (
              <Input
                type="number"
                variant="bordered"
                isRequired
                label={t('config.general.proxy.port')}
                value={proxyPort}
                onValueChange={(v) => {
                  if (v === '') {
                    setProxyPort('')
                  } else if (parseInt(v) > 65535) {
                    setProxyPort('65535')
                  } else if (parseInt(v) < 0) {
                    setProxyPort('')
                  } else {
                    setProxyPort(v)
                  }
                }}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {proxyUsername !== null && (
              <Input
                type="text"
                variant="bordered"
                label={t('config.general.proxy.username')}
                value={proxyUsername}
                onValueChange={(v) => {
                  setProxyUsername(v)
                }}
              />
            )}
            {proxyPassword !== null && (
              <Input
                type="password"
                variant="bordered"
                label={t('config.general.proxy.password')}
                value={proxyPassword}
                onValueChange={(v) => {
                  setProxyPassword(v)
                }}
              />
            )}
          </div>
          <div>
            {noProxy !== null && (
              <Input
                variant="bordered"
                label={t('config.general.proxy.no_proxy')}
                value={noProxy}
                onValueChange={(v) => {
                  setNoProxy(v)
                }}
              />
            )}
          </div>
        </CardBody>
      </Card>
    </>
  )
}
