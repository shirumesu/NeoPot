import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invokePlugin: vi.fn(),
}))

vi.mock('@/renderer/lib/plugin/invoke_plugin', () => ({
  invoke_plugin: mocks.invokePlugin,
}))

import { autoCopyTranslation } from '../../src/renderer/lib/service/autoCopyTranslation'
import {
  invokeTranslateService,
  TranslateServiceInvocationError,
} from '../../src/renderer/lib/service/invokeTranslateService'
import type { TranslateProvider } from '../../src/renderer/providers/translate'
import type { InstalledPlugin } from '../../src/renderer/windows/Config/pages/Plugin/installedPlugins'

const builtinTranslate = vi.fn()
const pluginTranslate = vi.fn()
const onStream = vi.fn()

const builtinServices = {
  google: {
    info: { icon: 'google.svg' },
    Language: { auto: 'auto', en: 'en', zh_cn: 'zh-CN' },
    translate: builtinTranslate,
  },
} satisfies Record<string, TranslateProvider>

const pluginServices = {
  custom: {
    display: 'Custom',
    icon: 'custom.svg',
    language: { auto: 'auto-plugin', en: 'en-plugin', zh_cn: 'zh-plugin' },
  } as InstalledPlugin,
}

beforeEach(() => {
  vi.clearAllMocks()
  builtinTranslate.mockResolvedValue('builtin result')
  pluginTranslate.mockResolvedValue('plugin result')
  mocks.invokePlugin.mockResolvedValue([pluginTranslate, { http: {} }])
})

describe('invokeTranslateService', () => {
  it('maps built-in languages and forwards config, detection, and stream updates', async () => {
    const config = { custom_url: 'https://example.test' }

    await expect(
      invokeTranslateService({
        instanceKey: 'google@one',
        text: 'hello',
        from: 'auto',
        to: 'zh_cn',
        detect: 'en',
        serviceInstanceConfigMap: { 'google@one': config },
        pluginServices: {},
        builtinServices,
        onStream,
      }),
    ).resolves.toBe('builtin result')

    expect(builtinTranslate).toHaveBeenCalledWith('hello', 'auto', 'zh-CN', {
      config,
      detect: 'en',
      setResult: onStream,
    })
  })

  it('maps plugin languages and passes an enabled config copy plus sandbox utils', async () => {
    const config = { token: 'test-token', enable: false }

    await expect(
      invokeTranslateService({
        instanceKey: 'plugin:custom@one',
        text: 'hello',
        from: 'en',
        to: 'zh_cn',
        detect: 'en',
        serviceInstanceConfigMap: { 'plugin:custom@one': config },
        pluginServices,
        builtinServices: {},
        onStream,
      }),
    ).resolves.toBe('plugin result')

    expect(mocks.invokePlugin).toHaveBeenCalledWith('translate', 'custom')
    expect(pluginTranslate).toHaveBeenCalledWith('hello', 'en-plugin', 'zh-plugin', {
      config: { token: 'test-token', enable: true },
      detect: 'en',
      setResult: onStream,
      utils: { http: {} },
    })
    expect(config.enable).toBe(false)
  })

  it('distinguishes unsupported languages from missing service configuration', async () => {
    const unsupported = invokeTranslateService({
      instanceKey: 'google@one',
      text: 'hello',
      from: 'fr',
      to: 'zh_cn',
      detect: 'fr',
      serviceInstanceConfigMap: { 'google@one': {} },
      pluginServices: {},
      builtinServices,
      onStream,
    })
    await expect(unsupported).rejects.toMatchObject<TranslateServiceInvocationError>({
      code: 'language-not-supported',
    })

    const missingConfig = invokeTranslateService({
      instanceKey: 'google@one',
      text: 'hello',
      from: 'en',
      to: 'zh_cn',
      detect: 'en',
      serviceInstanceConfigMap: {},
      pluginServices: {},
      builtinServices,
      onStream,
    })
    await expect(missingConfig).rejects.toMatchObject<TranslateServiceInvocationError>({
      code: 'service-not-configured',
    })
  })
})

describe('autoCopyTranslation', () => {
  it('copies the requested result shape and only notifies for hidden windows', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()

    await autoCopyTranslation({
      mode: 'source_target',
      targetIndex: 0,
      clipboardMonitor: false,
      hideWindow: true,
      sourceText: 'source',
      targetText: 'target',
      writeText,
      notify,
    })

    expect(writeText).toHaveBeenCalledWith('source\n\ntarget')
    expect(notify).toHaveBeenCalledWith('source\n\ntarget')
  })

  it('does not copy secondary targets or compete with clipboard monitoring', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const baseOptions = {
      mode: 'target' as const,
      hideWindow: false,
      sourceText: 'source',
      targetText: 'target',
      writeText,
      notify,
    }

    await autoCopyTranslation({
      ...baseOptions,
      targetIndex: 1,
      clipboardMonitor: false,
    })
    await autoCopyTranslation({
      ...baseOptions,
      targetIndex: 0,
      clipboardMonitor: true,
    })

    expect(writeText).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})
