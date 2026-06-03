import { unregister, isRegistered } from '@/renderer/lib/electron/compat/globalShortcut'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Button } from '@heroui/react'
import { Input } from '@heroui/react'
import { Card } from '@heroui/react'
import React, { useEffect, useState } from 'react'

import { useConfig } from '../../../../hooks/useConfig'
import PluginHotkeyEditor from '../../components/PluginHotkeyEditor'
import { useToastStyle } from '../../../../hooks'
import { osType } from '@/renderer/lib/config/env'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { getStoreValue } from '@/renderer/lib/config/store'
import { loadInstalledPlugins } from '../Plugin/installedPlugins'
import { useConfigSave } from '../../hooks/useConfigSave'

const keyMap = {
  Backquote: '`',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Plus: 'PLUS',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Backspace: 'Backspace',
  CapsLock: 'Capslock',
  ContextMenu: 'Contextmenu',
  Space: 'Space',
  Tab: 'Tab',
  Convert: 'Convert',
  Delete: 'Delete',
  End: 'End',
  Help: 'Help',
  Home: 'Home',
  PageDown: 'Pagedown',
  PageUp: 'Pageup',
  Escape: 'Esc',
  PrintScreen: 'Printscreen',
  ScrollLock: 'Scrolllock',
  Pause: 'Pause',
  Insert: 'Insert',
  Suspend: 'Suspend',
}

type PluginHotkeyRow = {
  pluginId: string
  pluginDisplay: string
  key: string
  display: string
  hotkey: string
}

export default function Hotkey() {
  const [selectionTranslate, setSelectionTranslate] = useConfig('hotkey_selection_translate', '', {
    sync: false,
  })
  const [inputTranslate, setInputTranslate] = useConfig('hotkey_input_translate', '', {
    sync: false,
  })
  const [ocrRecognize, setOcrRecognize] = useConfig('hotkey_ocr_recognize', '', {
    sync: false,
  })
  const [ocrTranslate, setOcrTranslate] = useConfig('hotkey_ocr_translate', '', {
    sync: false,
  })
  const [pluginHotkeyRows, setPluginHotkeyRows] = useState<PluginHotkeyRow[]>([])

  const { t } = useTranslation()
  const toastStyle = useToastStyle()
  const { saveConfig } = useConfigSave()

  useEffect(() => {
    loadInstalledPlugins().then((plugins) => {
      setPluginHotkeyRows(
        plugins.flatMap((plugin) =>
          (plugin.hotkeys ?? []).map((hotkey: any) => ({
            pluginId: plugin.id,
            pluginDisplay: plugin.display,
            key: hotkey.key,
            display: hotkey.display,
            hotkey: hotkey.default,
          })),
        ),
      )
    })
  }, [])

  function keyDown(e: React.KeyboardEvent, name: string, setKey: any) {
    e.preventDefault()
    if (e.keyCode === 8) {
      void clearHandler(name, setKey)
    } else {
      let newValue = ''
      if (e.ctrlKey) {
        newValue = 'Ctrl'
      }
      if (e.shiftKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`
      }
      if (e.metaKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${osType === 'Darwin' ? 'Command' : 'Super'}`
      }
      if (e.altKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`
      }
      let code = e.code
      if (code.startsWith('Key')) {
        code = code.substring(3)
      } else if (code.startsWith('Digit')) {
        code = code.substring(5)
      } else if (code.startsWith('Numpad')) {
        code = 'Num' + code.substring(6)
      } else if (code.startsWith('Arrow')) {
        code = code.substring(5)
      } else if (code.startsWith('Intl')) {
        code = code.substring(4)
      } else if (!/F\d+/.test(code)) {
        if ((keyMap as Record<string, string>)[code] !== undefined) {
          code = (keyMap as Record<string, string>)[code]
        } else {
          code = ''
        }
      }
      setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`)
    }
  }

  async function clearHandler(name: string, setKey: any) {
    try {
      const savedValue = await getStoreValue(name)
      if (typeof savedValue === 'string' && savedValue !== '') {
        unregister(savedValue)
      }
      await saveConfig(name, null, setKey, '', {
        compareCurrent: false,
      })
    } catch {
      toast.error(t('config.common.save_failed'), { style: toastStyle })
    }
  }

  function registerHandler(name: string, key: string, setKey: any) {
    isRegistered(key).then((res) => {
      if (res) {
        toast.error(t('config.hotkey.is_register'), { style: toastStyle })
      } else {
        invoke('register_shortcut_by_frontend', {
          name: name,
          shortcut: key,
        }).then(
          async (registered) => {
            try {
              if (!registered) {
                toast.error(t('config.common.save_failed'), { style: toastStyle })
                return
              }

              await saveConfig(name, null, setKey, key, {
                compareCurrent: false,
              })
            } catch {
              toast.error(t('config.common.save_failed'), { style: toastStyle })
            }
          },
          () => {
            toast.error(t('config.common.save_failed'), { style: toastStyle })
          },
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <div className="config-item">
            <h3 className="my-auto">{t('config.hotkey.selection_translate')}</h3>
            {selectionTranslate !== null && (
              <Input
                type="hotkey"
                variant="bordered"
                value={selectionTranslate}
                label={t('config.hotkey.set_hotkey')}
                className="max-w-[60%]"
                onKeyDown={(e) => {
                  keyDown(e, 'hotkey_selection_translate', setSelectionTranslate)
                }}
                endContent={
                  <Button
                    size="sm"
                    variant="flat"
                    className={`${selectionTranslate === '' && 'hidden'}`}
                    onPress={() => {
                      registerHandler(
                        'hotkey_selection_translate',
                        selectionTranslate,
                        setSelectionTranslate,
                      )
                    }}
                  >
                    {t('common.ok')}
                  </Button>
                }
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto">{t('config.hotkey.input_translate')}</h3>
            {inputTranslate !== null && (
              <Input
                type="hotkey"
                variant="bordered"
                value={inputTranslate}
                label={t('config.hotkey.set_hotkey')}
                className="max-w-[60%]"
                onKeyDown={(e) => {
                  keyDown(e, 'hotkey_input_translate', setInputTranslate)
                }}
                endContent={
                  <Button
                    size="sm"
                    variant="flat"
                    className={`${inputTranslate === '' && 'hidden'}`}
                    onPress={() => {
                      registerHandler('hotkey_input_translate', inputTranslate, setInputTranslate)
                    }}
                  >
                    {t('common.ok')}
                  </Button>
                }
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto">{t('config.hotkey.ocr_recognize')}</h3>
            {ocrRecognize !== null && (
              <Input
                type="hotkey"
                variant="bordered"
                value={ocrRecognize}
                label={t('config.hotkey.set_hotkey')}
                className="max-w-[60%]"
                onKeyDown={(e) => {
                  keyDown(e, 'hotkey_ocr_recognize', setOcrRecognize)
                }}
                endContent={
                  <Button
                    size="sm"
                    variant="flat"
                    className={`${ocrRecognize === '' && 'hidden'}`}
                    onPress={() => {
                      registerHandler('hotkey_ocr_recognize', ocrRecognize, setOcrRecognize)
                    }}
                  >
                    {t('common.ok')}
                  </Button>
                }
              />
            )}
          </div>
          <div className="config-item">
            <h3 className="my-auto">{t('config.hotkey.ocr_translate')}</h3>
            {ocrTranslate !== null && (
              <Input
                type="hotkey"
                variant="bordered"
                value={ocrTranslate}
                label={t('config.hotkey.set_hotkey')}
                className="max-w-[60%]"
                onKeyDown={(e) => {
                  keyDown(e, 'hotkey_ocr_translate', setOcrTranslate)
                }}
                endContent={
                  <Button
                    size="sm"
                    variant="flat"
                    className={`${ocrTranslate === '' && 'hidden'}`}
                    onPress={() => {
                      registerHandler('hotkey_ocr_translate', ocrTranslate, setOcrTranslate)
                    }}
                  >
                    {t('common.ok')}
                  </Button>
                }
              />
            )}
          </div>
        </CardBody>
      </Card>
      {pluginHotkeyRows.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="font-semibold mb-2">{t('config.hotkey.plugin_section')}</h2>
            <PluginHotkeyEditor rows={pluginHotkeyRows} />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
