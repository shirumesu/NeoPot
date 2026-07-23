// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  builtinTts: vi.fn(),
  invokePlugin: vi.fn(),
  playVoice: vi.fn(),
  pluginTts: vi.fn(),
  readTextFile: vi.fn(),
  serviceList: ['lingva@builtin'],
}))

vi.mock('@/renderer/hooks/useConfig', () => ({
  useConfig: () => [mocks.serviceList],
}))
vi.mock('@/renderer/hooks/useVoice', () => ({
  useVoice: () => mocks.playVoice,
}))
vi.mock('@/renderer/lib/electron/files', () => ({
  FileBase: {
    Config: 'AppConfig',
  },
  readTextFile: mocks.readTextFile,
}))
vi.mock('@/renderer/lib/plugin/invoke_plugin', () => ({
  invoke_plugin: mocks.invokePlugin,
}))
vi.mock('@/renderer/providers/tts', () => ({
  lingva: {
    info: {
      icon: 'lingva.svg',
    },
    Language: {
      en: 'en-US',
    },
    tts: mocks.builtinTts,
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

import { isAudioData, useTtsSpeak } from '../../src/renderer/hooks/useTtsSpeak'

const emptyPluginList = {
  recognize: {},
  translate: {},
  tts: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.serviceList = ['lingva@builtin']
  mocks.builtinTts.mockResolvedValue(new Uint8Array([1, 2, 3]))
  mocks.playVoice.mockResolvedValue(undefined)
  mocks.pluginTts.mockResolvedValue(new Uint8Array([4, 5, 6]))
  mocks.invokePlugin.mockResolvedValue([mocks.pluginTts, { fetch: vi.fn() }])
  mocks.readTextFile.mockResolvedValue(JSON.stringify({ language: { en: 'en-US' } }))
})

afterEach(cleanup)

describe('useTtsSpeak', () => {
  it('maps a built-in language and plays the validated provider response', async () => {
    const serviceInstanceConfigMap = {
      'lingva@builtin': {
        custom_url: 'https://example.test',
      },
    }
    const { result } = renderHook(() =>
      useTtsSpeak({
        pluginList: emptyPluginList,
        serviceInstanceConfigMap,
      }),
    )

    await act(() => result.current.speak('hello', 'en'))

    expect(mocks.builtinTts).toHaveBeenCalledWith('hello', 'en-US', {
      config: serviceInstanceConfigMap['lingva@builtin'],
    })
    expect(mocks.playVoice).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
  })

  it('loads plugin languages and invokes the selected plugin with its instance config', async () => {
    mocks.serviceList = ['plugin:voice@installed']
    const pluginList = {
      ...emptyPluginList,
      tts: {
        voice: {},
      },
    }
    const serviceInstanceConfigMap = {
      'plugin:voice@installed': {
        token: 'local-test-token',
      },
    }
    const { result } = renderHook(() =>
      useTtsSpeak({
        pluginList,
        serviceInstanceConfigMap,
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })
    await act(() => result.current.speak('hello', 'en'))

    expect(mocks.readTextFile).toHaveBeenCalledWith('plugins/tts/voice/info.json', {
      baseDir: 'AppConfig',
    })
    expect(mocks.invokePlugin).toHaveBeenCalledWith('tts', 'voice')
    expect(mocks.pluginTts).toHaveBeenCalledWith('hello', 'en-US', {
      config: serviceInstanceConfigMap['plugin:voice@installed'],
      utils: expect.any(Object),
    })
    expect(mocks.playVoice).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]))
  })

  it('rejects unsupported languages and invalid provider audio before playback', async () => {
    const { result } = renderHook(() =>
      useTtsSpeak({
        pluginList: emptyPluginList,
        serviceInstanceConfigMap: {},
      }),
    )

    await expect(result.current.speak('hello', 'zh')).rejects.toThrow(
      'errors.language_not_supported',
    )

    mocks.builtinTts.mockResolvedValue('not audio')
    await expect(result.current.speak('hello', 'en')).rejects.toThrow(
      'TTS provider returned invalid audio data.',
    )
    expect(mocks.playVoice).not.toHaveBeenCalled()
  })
})

describe('isAudioData', () => {
  it('accepts supported binary shapes and rejects unrelated values', () => {
    expect(isAudioData(new ArrayBuffer(2))).toBe(true)
    expect(isAudioData(new Uint8Array([1, 2]))).toBe(true)
    expect(isAudioData([1, 2])).toBe(true)
    expect(isAudioData([1, '2'])).toBe(false)
    expect(isAudioData('audio')).toBe(false)
  })
})
