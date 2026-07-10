import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, test } from 'vitest'

import { readPluginMarketplaceFromSource } from '../../src/main/plugins/marketplace.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const plugin = (overrides = {}) => ({
  id: 'translate:demo',
  type: 'translate',
  name: 'demo',
  display: 'Demo',
  version: '1.2.3',
  author: 'NeoPot',
  description: 'Demo plugin',
  repo: 'https://github.com/shirumesu/Neopot-releases',
  download: 'https://example.test/demo.zip',
  ...overrides,
})

test('marketplace reader accepts a local JSON file and returns defensive copies', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'neopot-marketplace-'))
  const file = path.join(dir, 'custom.json')
  await writeFile(file, JSON.stringify([plugin()]), 'utf8')

  const first = await readPluginMarketplaceFromSource(file)
  first[0].display = 'Mutated'
  const second = await readPluginMarketplaceFromSource(file)

  assert.equal(first[0].display, 'Mutated')
  assert.equal(second[0].display, 'Demo')
})

test('marketplace reader accepts local repository directories and file URLs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'neopot-marketplace-'))
  const repoDir = path.join(dir, 'repo')
  await mkdir(repoDir)
  await writeFile(
    path.join(repoDir, 'marketplace-plugins.json'),
    JSON.stringify([plugin()]),
    'utf8',
  )

  assert.deepEqual(await readPluginMarketplaceFromSource(repoDir), [plugin()])
  assert.deepEqual(await readPluginMarketplaceFromSource(pathToFileURL(repoDir).toString()), [
    plugin(),
  ])
})

test('marketplace reader rejects malformed local indexes instead of hiding partial entries', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'neopot-marketplace-'))
  const file = path.join(dir, 'marketplace-plugins.json')
  await writeFile(file, JSON.stringify([{ id: 'translate:demo', name: 'demo' }]), 'utf8')

  await assert.rejects(
    () => readPluginMarketplaceFromSource(file),
    /array of complete plugin entries/,
  )
})

test('marketplace reader resolves GitHub repository shorthand to raw marketplace candidates', async () => {
  const calls = []

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return {
      ok: true,
      text: async () => JSON.stringify([plugin({ id: 'tts:say', type: 'tts', name: 'say' })]),
    }
  }

  const result = await readPluginMarketplaceFromSource('github.com/shirumesu/Neopot-releases')

  assert.deepEqual(result, [plugin({ id: 'tts:say', type: 'tts', name: 'say' })])
  assert.equal(
    calls[0].url,
    'https://raw.githubusercontent.com/shirumesu/Neopot-releases/main/marketplace-plugins.json',
  )
  assert.equal(calls[0].init.cache, 'no-cache')
  assert.ok(calls[0].init.signal, 'fetch should receive an abort signal')
})

test('marketplace reader falls back from main to master for GitHub root sources', async () => {
  const calls = []

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (calls.length === 1) {
      return { ok: false, status: 404, text: async () => '' }
    }
    return { ok: true, text: async () => JSON.stringify([plugin()]) }
  }

  assert.deepEqual(await readPluginMarketplaceFromSource('https://github.com/owner/repo.git'), [
    plugin(),
  ])
  assert.deepEqual(calls, [
    'https://raw.githubusercontent.com/owner/repo/main/marketplace-plugins.json',
    'https://raw.githubusercontent.com/owner/repo/master/marketplace-plugins.json',
  ])
})

test('marketplace reader resolves GitHub blob and tree URLs to their raw JSON targets', async () => {
  const calls = []

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return { ok: true, text: async () => JSON.stringify([plugin()]) }
  }

  await readPluginMarketplaceFromSource(
    'https://github.com/owner/repo/blob/dev/feeds/marketplace-plugins.json',
  )
  await readPluginMarketplaceFromSource('https://github.com/owner/repo/tree/dev/feeds')

  assert.deepEqual(calls, [
    'https://raw.githubusercontent.com/owner/repo/dev/feeds/marketplace-plugins.json',
    'https://raw.githubusercontent.com/owner/repo/dev/feeds/marketplace-plugins.json',
  ])
})
