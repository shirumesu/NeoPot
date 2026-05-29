// @ts-nocheck
import { unregister, isRegistered } from '@/utils/electron_compat/globalShortcut'
import toast, { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Button } from '@heroui/react'
import { Input } from '@heroui/react'
import { Card } from '@heroui/react'
import React from 'react'

import { isSameConfigValue, useConfig } from '../../../../hooks/useConfig'
import { useToastStyle } from '../../../../hooks'
import { osType } from '../../../../utils/env'
import { invoke } from '@/utils/electron_compat/core'
import { getStoreValue } from '../../../../utils/store'

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

  const { t } = useTranslation()
  const toastStyle = useToastStyle()

  function keyDown(e, name, setKey) {
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
        if (keyMap[code] !== undefined) {
          code = keyMap[code]
        } else {
          code = ''
        }
      }
      setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`)
    }
  }

  async function verifySavedConfig(name, key) {
    const savedValue = await getStoreValue(name)
    if (!isSameConfigValue(savedValue, key)) {
      throw new Error(`Config "${name}" was not saved`)
    }
  }

  async function clearHandler(name, setKey) {
    try {
      const savedValue = await getStoreValue(name)
      if (typeof savedValue === 'string' && savedValue !== '') {
        unregister(savedValue)
      }
      await setKey('', true)
      await verifySavedConfig(name, '')
      toast.success(t('config.common.save_success'), { style: toastStyle })
    } catch {
      toast.error(t('config.common.save_failed'), { style: toastStyle })
    }
  }

  function registerHandler(name, key, setKey) {
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

              await setKey(key, true)
              await verifySavedConfig(name, key)
              toast.success(t('config.common.save_success'), { style: toastStyle })
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
    <Card>
      <Toaster position="top-center" />
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
  )
}
