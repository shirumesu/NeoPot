import { expect, it } from 'vitest'

import { runtimePlatform } from '../../src/shared/platform'

it.each([
  ['win32', 'Windows_NT'],
  ['darwin', 'Darwin'],
  ['linux', 'Linux'],
] as const)('maps Node platform %s to the renderer contract', (platform, expected) => {
  expect(runtimePlatform(platform)).toBe(expected)
})
