import {
  VscChromeClose,
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeRestore,
} from 'react-icons/vsc'
import React, { useEffect, useState } from 'react'
import { getCurrentWebviewWindow } from '@/renderer/lib/electron/compat/webviewWindow'
import { listen } from '@/renderer/lib/electron/compat/event'
import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { osType } from '@/renderer/lib/config/env'
import './style.css'
const appWindow = getCurrentWebviewWindow()

export default function WindowControl() {
  const [isMax, setIsMax] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    void listen('neopot://resize', async () => {
      if (await appWindow.isMaximized()) {
        setIsMax(true)
      } else {
        setIsMax(false)
      }
    })
  }, [])

  return (
    <div>
      <Button
        isIconOnly
        variant="light"
        className="w-8.75 h-8.75 rounded-none"
        aria-label={t('accessibility.minimize_window')}
        onPress={() => appWindow.minimize()}
      >
        <VscChromeMinimize className="text-[16px]" />
      </Button>
      <Button
        isIconOnly
        variant="light"
        className="w-8.75 h-8.75 rounded-none"
        aria-label={t(isMax ? 'accessibility.restore_window' : 'accessibility.maximize_window')}
        onPress={() => {
          if (isMax) {
            void appWindow.unmaximize()
          } else {
            void appWindow.maximize()
          }
        }}
      >
        {isMax ? (
          <VscChromeRestore className="text-[16px]" />
        ) : (
          <VscChromeMaximize className="text-[16px]" />
        )}
      </Button>
      <Button
        isIconOnly
        variant="light"
        className={`w-8.75 h-8.75 rounded-none close-button ${osType === 'Linux' && 'rounded-tr-[10px]'}`}
        aria-label={t('accessibility.close_window')}
        onPress={() => void appWindow.close()}
      >
        <VscChromeClose className="text-[16px]" />
      </Button>
    </div>
  )
}
