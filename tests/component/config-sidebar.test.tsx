// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SideBar from '../../src/renderer/windows/Config/components/SideBar'

const routeMock = vi.hoisted(() => ({
  preloadConfigRoute: vi.fn(),
}))

vi.mock('../../src/renderer/windows/Config/routes', () => routeMock)

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    className,
    fullWidth,
    onPress,
    size,
    startContent,
    variant,
    ...buttonProps
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    fullWidth?: boolean
    onPress?: () => void
    size?: string
    startContent?: ReactNode
    variant?: string
  }) => {
    void fullWidth
    void size

    return (
      <button
        {...buttonProps}
        className={className}
        data-variant={variant}
        type="button"
        onClick={() => onPress?.()}
      >
        {startContent}
        {children}
      </button>
    )
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      'windows.config': 'Config',
      'config.general.label': 'General',
      'config.translate.label': 'Translation',
      'config.recognize.label': 'Text Recognition',
      'config.hotkey.label': 'Hotkeys',
      'config.service.label': 'Services',
      'config.plugin.label': 'Plugins',
      'config.about.label': 'About',
    }

    return {
      t: (key: string) => translations[key] ?? key,
    }
  },
}))

const routes = [
  ['/general', 'General'],
  ['/translate', 'Translation'],
  ['/recognize', 'Text Recognition'],
  ['/hotkey', 'Hotkeys'],
  ['/service', 'Services'],
  ['/plugin', 'Plugins'],
  ['/about', 'About'],
] as const

afterEach(cleanup)

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderSideBar(initialEntry = '/general') {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <SideBar />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('Config SideBar', () => {
  it('exposes all config destinations as an accessible navigation with one current page', () => {
    renderSideBar('/translate')

    const navigation = screen.getByRole('navigation', { name: 'Config' })
    const buttons = within(navigation).getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual(routes.map(([, label]) => label))
    expect(
      within(navigation).getByRole('button', { name: 'Translation' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('navigates to every real config route and updates the observable current item', async () => {
    const user = userEvent.setup()
    renderSideBar()

    const navigation = screen.getByRole('navigation', { name: 'Config' })

    for (const [path, label] of routes) {
      const button = within(navigation).getByRole('button', { name: label })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('location').textContent).toBe(path)
      })
      expect(button.getAttribute('aria-current')).toBe('page')
      expect(button.getAttribute('data-variant')).toBe('flat')
      expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    }
  })

  it('preloads a destination when the user signals navigation intent', async () => {
    const user = userEvent.setup()
    renderSideBar()
    const button = screen.getByRole('button', { name: 'Plugins' })

    await user.hover(button)
    expect(routeMock.preloadConfigRoute).toHaveBeenCalledWith('/plugin')

    routeMock.preloadConfigRoute.mockClear()
    button.focus()
    expect(routeMock.preloadConfigRoute).toHaveBeenCalledWith('/plugin')
  })
})
