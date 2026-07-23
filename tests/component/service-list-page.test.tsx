// @vitest-environment jsdom

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ServiceListPage from '../../src/renderer/windows/Config/pages/Service/ServiceListPage'
import { ServiceType } from '../../src/renderer/lib/service/service_instance'

const mocks = vi.hoisted(() => ({
  configModal: vi.fn(() => <div data-testid="config-modal" />),
  deleteServiceInstance: vi.fn(),
  handleServiceReorder: vi.fn(),
  selectModal: vi.fn(() => <div data-testid="select-modal" />),
  selectPluginModal: vi.fn(() => <div data-testid="select-plugin-modal" />),
  serviceItem: vi.fn(() => <div data-testid="service-item" />),
  updateServiceInstanceList: vi.fn(),
  useServiceInstanceList: vi.fn(),
}))

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    fullWidth,
    onPress,
    ...buttonProps
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    fullWidth?: boolean
    onPress?: () => void
  }) => {
    void fullWidth

    return (
      <button {...buttonProps} type="button" onClick={onPress}>
        {children}
      </button>
    )
  },
  Card: ({ children, ...cardProps }: HTMLAttributes<HTMLDivElement>) => (
    <div {...cardProps}>{children}</div>
  ),
  useDisclosure: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onOpenChange: vi.fn(),
  }),
}))

vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../src/renderer/lib/config/env', () => ({
  osType: 'Linux',
}))

vi.mock('../../src/renderer/windows/Config/pages/Service/useServiceInstanceList', () => ({
  useServiceInstanceList: mocks.useServiceInstanceList,
}))
vi.mock('../../src/renderer/windows/Config/pages/Service/ServiceItem', () => ({
  default: mocks.serviceItem,
}))
vi.mock('../../src/renderer/windows/Config/pages/Service/SelectPluginModal', () => ({
  default: mocks.selectPluginModal,
}))
vi.mock('../../src/renderer/windows/Config/pages/Service/SelectModal', () => ({
  default: mocks.selectModal,
}))
vi.mock('../../src/renderer/windows/Config/pages/Service/ConfigModal', () => ({
  default: mocks.configModal,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ServiceListPage', () => {
  it('keeps list behavior and all three modal variants wired to the service parameters', () => {
    mocks.useServiceInstanceList.mockReturnValue({
      serviceInstanceList: ['deepl', 'google'],
      deleteServiceInstance: mocks.deleteServiceInstance,
      updateServiceInstanceList: mocks.updateServiceInstanceList,
      handleServiceReorder: mocks.handleServiceReorder,
    })
    const builtinServices = {
      deepl: { info: { name: 'deepl' } },
      google: { info: { name: 'google' } },
    }

    render(
      <ServiceListPage
        builtinServices={builtinServices}
        configKey="translate_service_list"
        defaultList={['deepl', 'google']}
        initialConfigKey="deepl"
        pluginList={{}}
        serviceType={ServiceType.TRANSLATE}
        pluginLabelSeparator=""
        protectLastService
        showEnableSwitch
      />,
    )

    expect(mocks.useServiceInstanceList).toHaveBeenCalledWith({
      configKey: 'translate_service_list',
      defaultList: ['deepl', 'google'],
      protectLastService: true,
    })
    expect(screen.getAllByTestId('service-item')).toHaveLength(2)
    expect(mocks.serviceItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        builtinServices,
        pluginLabelSeparator: '',
        serviceInstanceKey: 'deepl',
        serviceType: ServiceType.TRANSLATE,
        showEnableSwitch: true,
      }),
      undefined,
    )
    expect(screen.getByTestId('select-plugin-modal')).toBeTruthy()
    expect(mocks.selectModal).toHaveBeenCalledWith(
      expect.objectContaining({
        builtinServices,
        serviceType: ServiceType.TRANSLATE,
      }),
      undefined,
    )
    expect(mocks.configModal).toHaveBeenCalledWith(
      expect.objectContaining({
        builtinServices,
        guardEmptyServiceKey: undefined,
        serviceInstanceKey: 'deepl',
        serviceType: ServiceType.TRANSLATE,
      }),
      undefined,
    )
  })
})
