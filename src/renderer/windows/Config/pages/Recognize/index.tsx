import { DropdownTrigger } from '@heroui/react'
import { DropdownMenu } from '@heroui/react'
import { DropdownItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CardBody } from '@heroui/react'
import { Dropdown } from '@heroui/react'
import { Switch } from '@heroui/react'
import { Button } from '@heroui/react'
import { Card } from '@heroui/react'
import React from 'react'

import { languageList } from '@/renderer/lib/language/language'
import { useConfig } from '../../../../hooks'
import { useConfigSave } from '../../hooks/useConfigSave'

const DropdownMenuAny = DropdownMenu as any

export default function Recognize() {
  const [recognizeLanguage, setRecognizeLanguage] = useConfig('recognize_language', 'auto')
  const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline', false)
  const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy', false)
  const [hideWindow, setHideWindow] = useConfig('recognize_hide_window', false)
  const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur', false)
  const { t } = useTranslation()
  const { saveConfig } = useConfigSave()
  return (
    <Card className="mb-2.5">
      <CardBody>
        <div className="config-item">
          <h3 className="my-auto mx-0">{t('config.recognize.language')}</h3>
          {recognizeLanguage !== null && (
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered">{t(`languages.${recognizeLanguage}`)}</Button>
              </DropdownTrigger>
              <DropdownMenuAny
                aria-label="recognize language"
                className="max-h-[50vh] overflow-y-auto"
                onAction={(key: React.Key) => {
                  saveConfig(
                    'recognize_language',
                    recognizeLanguage,
                    setRecognizeLanguage,
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
          <h3 className="my-auto mx-0">{t('config.recognize.delete_newline')}</h3>
          {deleteNewline !== null && (
            <Switch
              isSelected={deleteNewline}
              onValueChange={(v) => {
                saveConfig('recognize_delete_newline', deleteNewline, setDeleteNewline, v)
              }}
            />
          )}
        </div>
        <div className="config-item">
          <h3 className="my-auto mx-0">{t('config.recognize.auto_copy')}</h3>
          {autoCopy !== null && (
            <Switch
              isSelected={autoCopy}
              onValueChange={(v) => {
                saveConfig('recognize_auto_copy', autoCopy, setAutoCopy, v)
              }}
            />
          )}
        </div>
        <div className="config-item">
          <h3 className="my-auto mx-0">{t('config.recognize.close_on_blur')}</h3>
          {closeOnBlur !== null && (
            <Switch
              isSelected={closeOnBlur}
              onValueChange={(v) => {
                saveConfig('recognize_close_on_blur', closeOnBlur, setCloseOnBlur, v)
              }}
            />
          )}
        </div>
        <div className="config-item">
          <h3 className="my-auto mx-0">{t('config.recognize.hide_window')}</h3>
          {hideWindow !== null && (
            <Switch
              isSelected={hideWindow}
              onValueChange={(v) => {
                saveConfig('recognize_hide_window', hideWindow, setHideWindow, v)
              }}
            />
          )}
        </div>
      </CardBody>
    </Card>
  )
}
