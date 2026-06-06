import { useCallback, useEffect, useMemo, useState } from 'react'

import type { UpdateCheckResult, UpdateEvent, UpdateProgress } from '@/shared/types/electron-api'
import {
  check,
  download,
  install,
  onEvent,
  openReleasePage,
} from '@/renderer/lib/electron/compat/updater'
import { getUpdatePrimaryAction, type UpdatePrimaryAction } from './updateActions'

export type UpdaterPhase = 'idle' | 'checking' | 'downloading' | 'ready-restart' | 'installing'

interface UseUpdaterControllerOptions {
  autoCheck?: boolean
  onError?: (message: string) => void
}

export interface UpdaterController {
  result: UpdateCheckResult | null
  progress: UpdateProgress | null
  phase: UpdaterPhase
  message: string
  isChecking: boolean
  isWorking: boolean
  primaryAction: UpdatePrimaryAction
  primaryDisabled: boolean
  refresh: () => Promise<UpdateCheckResult | null>
  runPrimaryAction: () => Promise<void>
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Update check failed.'
}

export function useUpdaterController({
  autoCheck = false,
  onError,
}: UseUpdaterControllerOptions = {}): UpdaterController {
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [phase, setPhase] = useState<UpdaterPhase>(autoCheck ? 'checking' : 'idle')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setPhase('checking')
    setProgress(null)
    setMessage('')

    try {
      const nextResult = await check()
      setResult(nextResult)
      setPhase((currentPhase) => (currentPhase === 'checking' ? 'idle' : currentPhase))

      if (nextResult.status === 'error') {
        const errorMessage = nextResult.message || safeErrorMessage(null)
        setMessage(errorMessage)
        onError?.(errorMessage)
      }

      return nextResult
    } catch (error) {
      const errorMessage = safeErrorMessage(error)
      setPhase('idle')
      setMessage(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  useEffect(() => {
    const unsubscribeUpdate = onEvent((event: UpdateEvent) => {
      if (event.type === 'checking') {
        setPhase('checking')
        setProgress(null)
        setMessage('')
        return
      }

      if (event.type === 'download-progress') {
        setProgress(event.progress)
        setPhase('downloading')
        setMessage('')
        return
      }

      if (event.type === 'downloaded') {
        setResult(event.result)
        setPhase('ready-restart')
        setMessage('')
        return
      }

      if (event.type === 'installing') {
        setPhase('installing')
        setMessage('')
        return
      }

      if (event.type === 'error') {
        if (event.result) {
          setResult(event.result)
        }
        setPhase('idle')
        setMessage(event.message)
        onError?.(event.message)
        return
      }

      setResult(event.result)
      setPhase('idle')
      setProgress(null)
      setMessage('')
    })

    const unsubscribeStartup = window.neoPot.app.onEvent('startup_update_available', (payload) => {
      setResult(payload as UpdateCheckResult)
      setPhase('idle')
      setMessage('')
    })

    return () => {
      unsubscribeUpdate()
      unsubscribeStartup()
    }
  }, [onError])

  useEffect(() => {
    if (autoCheck) {
      void refresh()
    }
  }, [autoCheck, refresh])

  const isChecking = phase === 'checking'
  const isWorking = phase === 'downloading' || phase === 'installing'
  const primaryAction = useMemo(
    () => getUpdatePrimaryAction(result, phase === 'ready-restart'),
    [phase, result],
  )
  const primaryDisabled = isChecking || isWorking || primaryAction === 'none'

  const runPrimaryAction = useCallback(async () => {
    try {
      switch (primaryAction) {
        case 'check':
          await refresh()
          return
        case 'open-release-page':
          await openReleasePage()
          return
        case 'install':
          setPhase('installing')
          await install()
          return
        case 'download':
          setPhase('downloading')
          await download()
          return
        case 'none':
          return
      }
    } catch (error) {
      const errorMessage = safeErrorMessage(error)
      setPhase('idle')
      setMessage(errorMessage)
      onError?.(errorMessage)
    }
  }, [onError, primaryAction, refresh])

  return {
    result,
    progress,
    phase,
    message,
    isChecking,
    isWorking,
    primaryAction,
    primaryDisabled,
    refresh,
    runPrimaryAction,
  }
}
