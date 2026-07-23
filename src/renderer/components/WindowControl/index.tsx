import {
  VscChromeClose,
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeRestore,
} from 'react-icons/vsc'
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { onAppEvent } from '@/renderer/lib/electron/events'
import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { LINUX_CLOSE_WINDOW_CORNER_CLASS, WINDOW_CONTROL_ICON_CLASS } from '../windowChrome'
import './style.css'
const appWindow = getCurrentWindow()

export default function WindowControl() {
  const [isMax, setIsMax] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    return onAppEvent('neopot://resize', async () => {
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
        <VscChromeMinimize className={WINDOW_CONTROL_ICON_CLASS} />
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
          <VscChromeRestore className={WINDOW_CONTROL_ICON_CLASS} />
        ) : (
          <VscChromeMaximize className={WINDOW_CONTROL_ICON_CLASS} />
        )}
      </Button>
      <Button
        isIconOnly
        variant="light"
        className={`w-8.75 h-8.75 rounded-none close-button ${LINUX_CLOSE_WINDOW_CORNER_CLASS}`}
        aria-label={t('accessibility.close_window')}
        onPress={() => void appWindow.close()}
      >
        <VscChromeClose className={WINDOW_CONTROL_ICON_CLASS} />
      </Button>
    </div>
  )
}
