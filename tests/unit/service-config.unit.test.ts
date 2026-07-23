import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeMock = vi.hoisted(() => ({
  getStoreValue: vi.fn(),
}))

vi.mock('@/renderer/lib/config/store', () => ({
  getStoreValue: storeMock.getStoreValue,
}))

import { loadServiceInstanceConfigMap } from '../../src/renderer/lib/service/serviceConfig'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('service instance config loading', () => {
  it('loads each unique instance once and normalizes non-object values', async () => {
    storeMock.getStoreValue.mockImplementation(async (key: string) => {
      if (key === 'google@one') {
        return { enable: true, custom_url: 'https://example.test' }
      }
      if (key === 'ollama@two') {
        return ['invalid']
      }
      return null
    })

    await expect(
      loadServiceInstanceConfigMap(['google@one', 'google@one', 'ollama@two', 'plugin:missing']),
    ).resolves.toEqual({
      'google@one': { enable: true, custom_url: 'https://example.test' },
      'ollama@two': {},
      'plugin:missing': {},
    })
    expect(storeMock.getStoreValue.mock.calls).toEqual([
      ['google@one'],
      ['ollama@two'],
      ['plugin:missing'],
    ])
  })

  it('propagates storage failures so each window can surface its own initialization error', async () => {
    storeMock.getStoreValue.mockRejectedValue(new Error('config unavailable'))

    await expect(loadServiceInstanceConfigMap(['google@one'])).rejects.toThrow('config unavailable')
  })
})
