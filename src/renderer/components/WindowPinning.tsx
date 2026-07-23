import { Button } from '@heroui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BsPinFill } from 'react-icons/bs'

import { onAppEvent } from '@/renderer/lib/electron/events'
import { getCurrentWindow } from '@/renderer/lib/electron/window'
import { PIN_ICON_CLASS } from './windowChrome'

const currentWindow = getCurrentWindow()

interface UseCloseOnBlurOptions {
  enabled: boolean
  delayMs: number
  initiallyPinned?: boolean
}

export function useCloseOnBlur({
  enabled,
  delayMs,
  initiallyPinned = false,
}: UseCloseOnBlurOptions) {
  const [isPinned, setIsPinned] = useState(false)
  const enabledRef = useRef(enabled)
  const pinnedRef = useRef(false)
  const skipNextBlurRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedInitialPinRef = useRef(false)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    if (!initiallyPinned || appliedInitialPinRef.current) {
      return
    }

    appliedInitialPinRef.current = true
    pinnedRef.current = true
    setIsPinned(true)
    void currentWindow.setAlwaysOnTop(true)
  }, [initiallyPinned])

  useEffect(() => {
    const clearCloseTimer = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
    const unsubscribeBlur = onAppEvent('neopot://blur', () => {
      if (!enabledRef.current || pinnedRef.current) {
        return
      }
      if (skipNextBlurRef.current) {
        skipNextBlurRef.current = false
        return
      }

      clearCloseTimer()
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        void currentWindow.close()
      }, delayMs)
    })
    const unsubscribeFocus = onAppEvent('neopot://focus', () => {
      skipNextBlurRef.current = false
      clearCloseTimer()
    })
    const unsubscribeMinimize = onAppEvent('neopot://minimize', () => {
      skipNextBlurRef.current = true
    })
    const unsubscribeMove = onAppEvent('neopot://move', clearCloseTimer)

    return () => {
      clearCloseTimer()
      unsubscribeBlur()
      unsubscribeFocus()
      unsubscribeMinimize()
      unsubscribeMove()
    }
  }, [delayMs])

  const togglePinned = useCallback(async () => {
    const nextPinned = !pinnedRef.current
    pinnedRef.current = nextPinned
    setIsPinned(nextPinned)
    await currentWindow.setAlwaysOnTop(nextPinned)
  }, [])

  return { isPinned, togglePinned }
}

export function PinButton({
  isPinned,
  onToggle,
}: {
  isPinned: boolean
  onToggle: () => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Button
      isIconOnly
      size="sm"
      variant="flat"
      disableAnimation
      className="my-auto mx-1.25 bg-transparent"
      aria-label={t(isPinned ? 'accessibility.unpin_window' : 'accessibility.pin_window')}
      onPress={() => void onToggle()}
    >
      <BsPinFill
        className={`${PIN_ICON_CLASS} ${isPinned ? 'text-primary' : 'text-default-400'}`}
      />
    </Button>
  )
}
