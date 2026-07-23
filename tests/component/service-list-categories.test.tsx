// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Recognize from '../../src/renderer/windows/Config/pages/Service/Recognize'
import Translate from '../../src/renderer/windows/Config/pages/Service/Translate'
import Tts from '../../src/renderer/windows/Config/pages/Service/Tts'
import { ServiceType } from '../../src/renderer/lib/service/service_instance'

const mocks = vi.hoisted(() => ({
  recognizeServices: { local_model: { info: { name: 'local_model' } } },
  serviceListPage: vi.fn(() => <div />),
  translateServices: {
    deepl: { info: { name: 'deepl' } },
    google: { info: { name: 'google' } },
  },
  ttsServices: { lingva: { info: { name: 'lingva' } } },
}))

vi.mock('../../src/renderer/windows/Config/pages/Service/ServiceListPage', () => ({
  default: mocks.serviceListPage,
}))
vi.mock('../../src/renderer/providers/translate', () => mocks.translateServices)
vi.mock('../../src/renderer/providers/recognize', () => mocks.recognizeServices)
vi.mock('../../src/renderer/providers/tts', () => mocks.ttsServices)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('service list categories', () => {
  it('preserves translation service defaults and last-service protection', () => {
    const pluginList = {}
    render(<Translate pluginList={pluginList} />)

    expect(mocks.serviceListPage).toHaveBeenCalledWith(
      {
        builtinServices: mocks.translateServices,
        configKey: 'translate_service_list',
        defaultList: ['deepl', 'google'],
        initialConfigKey: 'deepl',
        pluginLabelSeparator: '',
        pluginList,
        protectLastService: true,
        serviceType: ServiceType.TRANSLATE,
        showEnableSwitch: true,
      },
      undefined,
    )
  })

  it('preserves recognition service defaults and last-service protection', () => {
    const pluginList = {}
    render(<Recognize pluginList={pluginList} />)

    expect(mocks.serviceListPage).toHaveBeenCalledWith(
      {
        builtinServices: mocks.recognizeServices,
        configKey: 'recognize_service_list',
        defaultList: ['local_model'],
        initialConfigKey: 'local_model',
        pluginList,
        protectLastService: true,
        serviceType: ServiceType.RECOGNIZE,
      },
      undefined,
    )
  })

  it('preserves text-to-speech defaults and the empty-key modal guard', () => {
    const pluginList = {}
    render(<Tts pluginList={pluginList} />)

    expect(mocks.serviceListPage).toHaveBeenCalledWith(
      {
        builtinServices: mocks.ttsServices,
        configKey: 'tts_service_list',
        defaultList: ['lingva'],
        guardEmptyServiceKey: true,
        initialConfigKey: 'lingva',
        pluginList,
        serviceType: ServiceType.TTS,
      },
      undefined,
    )
  })
})
