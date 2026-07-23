import { isHotkeyRegistered, unregisterHotkey } from '@/renderer/lib/electron/hotkey'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Card } from '@heroui/react'
import React, { useEffect, useState } from 'react'

import { useConfig } from '../../../../hooks/useConfig'
import PluginHotkeyEditor from '../../components/PluginHotkeyEditor'
import HotkeyField from '../../components/HotkeyField'
import type { HotkeySetter } from '../../components/HotkeyField'
import { osType } from '@/renderer/lib/config/env'
import { shortcutFromKeyboardEvent } from '@/shared/hotkeyAccelerator'
import { invokeCommand } from '@/renderer/lib/electron/command'
import { getStoreValue } from '@/renderer/lib/config/store'
import { loadInstalledPlugins } from '../Plugin/installedPlugins'
import { useConfigSave } from '../../hooks/useConfigSave'
import { onAppEvent } from '@/renderer/lib/electron/events'
import {
  createPluginHotkeyRows,
  type PluginHotkeyRow,
} from '@/renderer/lib/plugin/pluginHotkeyManifest'

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
  const { saveConfig } = useConfigSave()

  useEffect(() => {
    const loadPluginHotkeys = () => {
      loadInstalledPlugins().then((plugins) => {
        setPluginHotkeyRows(
          plugins.filter((plugin) => plugin.enabled).flatMap(createPluginHotkeyRows),
        )
      })
    }

    const unlisten = onAppEvent('reload_plugin_list', loadPluginHotkeys)
    loadPluginHotkeys()

    return () => {
      unlisten()
    }
  }, [])

  function keyDown(e: React.KeyboardEvent, name: string, setKey: HotkeySetter) {
    e.preventDefault()
    if (e.keyCode === 8) {
      void clearHandler(name, setKey)
    } else {
      void setKey(shortcutFromKeyboardEvent(e, osType))
    }
  }

  async function clearHandler(name: string, setKey: HotkeySetter) {
    try {
      const savedValue = await getStoreValue(name)
      if (typeof savedValue === 'string' && savedValue !== '') {
        unregisterHotkey(savedValue)
      }
      await saveConfig(name, null, setKey, '', {
        compareCurrent: false,
      })
    } catch {
      toast.error(t('config.common.save_failed'))
    }
  }

  function registerHandler(name: string, key: string, setKey: HotkeySetter) {
    isHotkeyRegistered(key).then((res) => {
      if (res) {
        toast.error(t('config.hotkey.is_register'))
      } else {
        invokeCommand('register_shortcut_by_frontend', {
          name,
          shortcut: key,
        }).then(
          async (registered) => {
            try {
              if (!registered) {
                toast.error(t('config.common.save_failed'))
                return
              }

              await saveConfig(name, null, setKey, key, {
                compareCurrent: false,
              })
            } catch {
              toast.error(t('config.common.save_failed'))
            }
          },
          () => {
            toast.error(t('config.common.save_failed'))
          },
        )
      }
    })
  }

  return (
    <>
      <Card className="mb-2.5">
        <CardBody>
          <HotkeyField
            title={t('config.hotkey.selection_translate')}
            name="hotkey_selection_translate"
            value={selectionTranslate}
            setValue={setSelectionTranslate}
            inputLabel={t('config.hotkey.set_hotkey')}
            okLabel={t('common.ok')}
            onKeyDown={keyDown}
            onConfirm={registerHandler}
          />
          <HotkeyField
            title={t('config.hotkey.input_translate')}
            name="hotkey_input_translate"
            value={inputTranslate}
            setValue={setInputTranslate}
            inputLabel={t('config.hotkey.set_hotkey')}
            okLabel={t('common.ok')}
            onKeyDown={keyDown}
            onConfirm={registerHandler}
          />
          <HotkeyField
            title={t('config.hotkey.ocr_recognize')}
            name="hotkey_ocr_recognize"
            value={ocrRecognize}
            setValue={setOcrRecognize}
            inputLabel={t('config.hotkey.set_hotkey')}
            okLabel={t('common.ok')}
            onKeyDown={keyDown}
            onConfirm={registerHandler}
          />
          <HotkeyField
            title={t('config.hotkey.ocr_translate')}
            name="hotkey_ocr_translate"
            value={ocrTranslate}
            setValue={setOcrTranslate}
            inputLabel={t('config.hotkey.set_hotkey')}
            okLabel={t('common.ok')}
            onKeyDown={keyDown}
            onConfirm={registerHandler}
          />
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
    </>
  )
}
