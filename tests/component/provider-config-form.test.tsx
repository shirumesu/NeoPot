// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ProviderConfigForm from '../../src/renderer/windows/Config/pages/Service/ProviderConfigForm'
import TestButton from '../../src/renderer/windows/Config/pages/Service/TestButton'

const mocks = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    fullWidth,
    isLoading,
    onPress,
    ...buttonProps
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode
    fullWidth?: boolean
    isLoading?: boolean
    onPress?: () => void
  }) => {
    void fullWidth

    return (
      <button {...buttonProps} aria-busy={isLoading} onClick={onPress}>
        {children}
      </button>
    )
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

vi.mock('../../src/renderer/windows/Config/hooks/useConfigSave', () => ({
  useConfigSave: () => ({
    saveConfig: mocks.saveConfig,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveConfig.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
})

describe('ProviderConfigForm', () => {
  it('refreshes the saved instance and closes only after a successful save', async () => {
    const config = { value: 'configured' }
    const setConfig = vi.fn()
    const updateServiceList = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ProviderConfigForm
        instanceKey="translate:google"
        config={config}
        setConfig={setConfig}
        updateServiceList={updateServiceList}
        onClose={onClose}
        verify
      >
        <div>provider fields</div>
      </ProviderConfigForm>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mocks.saveConfig).toHaveBeenCalledWith('translate:google', null, setConfig, config, {
        compareCurrent: false,
        verify: true,
      })
      expect(updateServiceList).toHaveBeenCalledWith('translate:google')
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('keeps the provider form open when persistence fails', async () => {
    mocks.saveConfig.mockResolvedValue(false)
    const updateServiceList = vi.fn()
    const onClose = vi.fn()

    render(
      <ProviderConfigForm
        instanceKey="translate:google"
        config={{ value: 'configured' }}
        setConfig={vi.fn()}
        updateServiceList={updateServiceList}
        onClose={onClose}
      >
        <div>provider fields</div>
      </ProviderConfigForm>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => expect(mocks.saveConfig).toHaveBeenCalledOnce())
    expect(updateServiceList).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('TestButton', () => {
  it('reports a successful provider test and clears the loading state', async () => {
    const onTest = vi.fn().mockResolvedValue(undefined)
    const setIsLoading = vi.fn()

    render(<TestButton isLoading={false} setIsLoading={setIsLoading} onTest={onTest} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.test' }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith('config.service.test_success')
      expect(setIsLoading).toHaveBeenNthCalledWith(1, true)
      expect(setIsLoading).toHaveBeenLastCalledWith(false)
    })
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('reports provider test failures and always clears the loading state', async () => {
    const error = new Error('provider unavailable')
    const onTest = vi.fn().mockRejectedValue(error)
    const setIsLoading = vi.fn()

    render(<TestButton isLoading={false} setIsLoading={setIsLoading} onTest={onTest} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.test' }))

    await waitFor(() => {
      expect(onTest).toHaveBeenCalledOnce()
      expect(mocks.toastError).toHaveBeenCalledWith(
        'config.service.test_failedError: provider unavailable',
      )
      expect(setIsLoading).toHaveBeenNthCalledWith(1, true)
      expect(setIsLoading).toHaveBeenLastCalledWith(false)
    })
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})
