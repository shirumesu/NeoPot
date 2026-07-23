import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'vitest'

import { assertSafeExternalUrl } from '../../src/main/modules/externalUrlSafety.ts'
import {
  assertPublicHttpRequestUrl,
  assertPublicHttpUrl,
  isBlockedNetworkAddress,
} from '../../src/main/modules/networkSafety.ts'
import {
  RENDERER_HOST,
  RENDERER_SCHEME,
  resolveRendererFile,
} from '../../src/main/modules/rendererProtocol.ts'
import {
  DEFAULT_GOOGLE_TRANSLATE_URL,
  DEFAULT_LINGVA_URL,
  DEFAULT_OLLAMA_URL,
  normalizeGoogleTranslateBaseUrl,
  normalizeDeepLXEndpointUrl,
  normalizeLingvaBaseUrl,
  normalizeOllamaBaseUrl,
  normalizeProviderUrl,
} from '../../src/shared/providerUrl.ts'
import {
  createProxyRules,
  matchesProxyChallenge,
  normalizeProxyHost,
} from '../../src/shared/proxyConfig.ts'

test('external URL validation allows only safe default protocols', () => {
  assert.equal(assertSafeExternalUrl('https://example.com/path'), 'https://example.com/path')
  assert.equal(assertSafeExternalUrl('mailto:hello@example.com'), 'mailto:hello@example.com')

  for (const input of ['file:///C:/Windows/System32/calc.exe', 'pot://open', 'ftp://example.com']) {
    assert.throws(() => assertSafeExternalUrl(input), /protocol is not allowed/)
  }

  assert.throws(() => assertSafeExternalUrl('mailto://example.com/path'), /Malformed mailto URL/)
})

test('external URL validation can pin updater links to exact github.com releases', () => {
  const options = {
    allowedHosts: ['github.com'],
    allowedProtocols: ['https:'],
    allowSubdomains: false,
  }

  assert.equal(
    assertSafeExternalUrl('https://github.com/shirumesu/NeoPot/releases', options),
    'https://github.com/shirumesu/NeoPot/releases',
  )

  for (const input of [
    'https://github.com.evil.example/releases',
    'https://evilgithub.com/releases',
    'https://docs.github.com/releases',
  ]) {
    assert.throws(() => assertSafeExternalUrl(input, options), /host is not allowed/)
  }
})

test('network address classification blocks private, metadata, documentation, and multicast ranges', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ]) {
    assert.equal(isBlockedNetworkAddress(address), true, `${address} should be blocked`)
  }

  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isBlockedNetworkAddress(address), false, `${address} should be public`)
  }
})

test('public HTTP URL validation rejects unsafe protocols and local literal targets', () => {
  for (const input of [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'http://localhost:11434/api/tags',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
  ]) {
    assert.throws(() => assertPublicHttpUrl(input), /not allowed|valid HTTP request URL/)
  }

  assert.equal(assertPublicHttpUrl('https://example.com/path').origin, 'https://example.com')
  assert.equal(
    assertPublicHttpUrl('http://localhost:11434/api/tags', { allowPrivateNetwork: true }).origin,
    'http://localhost:11434',
  )
})

test('DNS resolution blocks private answers but tolerates proxy fake-IP answers for hostnames', async () => {
  assert.throws(() => assertPublicHttpUrl('http://198.18.0.147/'), /not allowed/)

  const fakeIpUrl = await assertPublicHttpRequestUrl('https://api.example.test/translate', {
    resolveHostname: async () => [{ address: '198.18.0.147' }],
  })
  assert.equal(fakeIpUrl.origin, 'https://api.example.test')

  await assert.rejects(
    () =>
      assertPublicHttpRequestUrl('https://api.example.test/translate', {
        resolveHostname: async () => [{ address: '192.168.1.10' }],
      }),
    /resolved to a blocked address: 192\.168\.1\.10/,
  )
})

test('provider base URL normalization preserves explicit schemes and defaults local targets to HTTP', () => {
  assert.equal(normalizeLingvaBaseUrl(undefined), DEFAULT_LINGVA_URL)
  assert.equal(normalizeLingvaBaseUrl('localhost:3000/'), 'http://localhost:3000')
  assert.equal(normalizeLingvaBaseUrl('127.0.0.1:3000/'), 'http://127.0.0.1:3000')
  assert.equal(normalizeLingvaBaseUrl('[::1]:3000/'), 'http://[::1]:3000')
  assert.equal(normalizeLingvaBaseUrl('192.168.1.20:3000/'), 'http://192.168.1.20:3000')
  assert.equal(normalizeLingvaBaseUrl('lingva.example.com/'), 'https://lingva.example.com')
  assert.equal(normalizeLingvaBaseUrl('https://localhost:3000/'), 'https://localhost:3000')
})

test('provider-specific defaults use the same shared base URL normalization', () => {
  assert.equal(normalizeOllamaBaseUrl(undefined), DEFAULT_OLLAMA_URL)
  assert.equal(
    normalizeOllamaBaseUrl('ollama.example.com:11434/'),
    'https://ollama.example.com:11434',
  )
  assert.equal(normalizeGoogleTranslateBaseUrl(undefined), DEFAULT_GOOGLE_TRANSLATE_URL)
  assert.equal(
    normalizeGoogleTranslateBaseUrl('translate.example.com/'),
    'https://translate.example.com',
  )
})

test('provider URL normalization rejects non-HTTP protocols and preserves endpoint paths', () => {
  assert.equal(normalizeProviderUrl('ftp://example.com'), null)
  assert.throws(() => normalizeLingvaBaseUrl('file:///tmp/socket'), /valid HTTP provider URL/)
  assert.equal(
    normalizeDeepLXEndpointUrl('127.0.0.1:1188/translate'),
    'http://127.0.0.1:1188/translate',
  )
  assert.equal(normalizeProviderUrl('localhost:3000/api/audio')?.origin, 'http://localhost:3000')
})

test('proxy host normalization accepts plain hosts and pasted HTTP proxy URLs', () => {
  assert.equal(normalizeProxyHost('proxy.example.com'), 'proxy.example.com')
  assert.equal(normalizeProxyHost(' Proxy.Example.COM '), 'proxy.example.com')
  assert.equal(normalizeProxyHost('proxy.example.com:7890'), 'proxy.example.com')
  assert.equal(normalizeProxyHost('http://proxy.example.com:7890/'), 'proxy.example.com')
  assert.equal(normalizeProxyHost('https://proxy.example.com'), 'proxy.example.com')
  assert.equal(normalizeProxyHost('127.0.0.1'), '127.0.0.1')
  assert.equal(normalizeProxyHost('[::1]:7890'), '[::1]')
})

test('proxy host normalization rejects URL components and proxy rule injection input', () => {
  for (const input of [
    '',
    'http://user:pass@proxy.example.com',
    'http://proxy.example.com/path',
    'proxy.example.com/path',
    'http://proxy.example.com?x=1',
    'http://proxy.example.com#fragment',
    'ftp://proxy.example.com',
    'proxy.example.com;https=evil.example:1',
    'proxy.example.com\\evil',
    'bad host.example',
    '-bad.example',
    'bad..example',
  ]) {
    assert.equal(normalizeProxyHost(input), undefined, input)
  }
})

test('session proxy rules use the configured HTTP proxy for Chromium network requests', () => {
  assert.equal(createProxyRules('proxy.example.com', 7890), 'http://proxy.example.com:7890')
  assert.equal(createProxyRules('[::1]', 8080), 'http://[::1]:8080')
})

test('proxy credentials are supplied only to the configured proxy challenge', () => {
  const proxy = { enabled: true, host: 'proxy.example.com', port: 7890 }

  assert.equal(
    matchesProxyChallenge({ isProxy: true, host: 'PROXY.EXAMPLE.COM', port: 7890 }, proxy),
    true,
  )
  assert.equal(
    matchesProxyChallenge({ isProxy: false, host: 'proxy.example.com', port: 7890 }, proxy),
    false,
  )
  assert.equal(
    matchesProxyChallenge({ isProxy: true, host: 'other.example.com', port: 7890 }, proxy),
    false,
  )
  assert.equal(
    matchesProxyChallenge({ isProxy: true, host: 'proxy.example.com', port: 7891 }, proxy),
    false,
  )
})

test('packaged renderer protocol resolves only neopot main-window files inside the renderer root', () => {
  const root = path.resolve('spec-test-renderer-root')
  const url = (suffix) => `${RENDERER_SCHEME}://${RENDERER_HOST}${suffix}`

  assert.equal(RENDERER_SCHEME, 'neopot')
  assert.equal(RENDERER_HOST, 'main_window')
  assert.equal(resolveRendererFile(url('/index.html'), root), path.join(root, 'index.html'))
  assert.equal(resolveRendererFile(url('/'), root), path.join(root, 'index.html'))
  assert.equal(
    resolveRendererFile(url('/assets/app.js'), root),
    path.resolve(root, 'assets/app.js'),
  )
  assert.equal(resolveRendererFile(url('/a%20b.js'), root), path.resolve(root, 'a b.js'))

  assert.equal(resolveRendererFile(`https://${RENDERER_HOST}/index.html`, root), null)
  assert.equal(resolveRendererFile(`${RENDERER_SCHEME}://evil.example/index.html`, root), null)
  assert.equal(resolveRendererFile('not a url', root), null)
  assert.equal(resolveRendererFile(url('/index%00.html'), root), null)
  assert.equal(resolveRendererFile(url('/%E0%A4'), root), null)
})

test('packaged renderer protocol containment rejects encoded separator traversal', () => {
  const root = path.resolve('spec-test-renderer-root')
  const url = (suffix) => `${RENDERER_SCHEME}://${RENDERER_HOST}${suffix}`
  const insideRoot = (resolved) => resolved === root || resolved.startsWith(root + path.sep)

  for (const attack of ['/%2e%2e%2fsecret', '/..%2f..%2fsecret', '/..%5c..%5cwindows']) {
    assert.equal(resolveRendererFile(url(attack), root), null, attack)
  }

  for (const normalized of [
    '/../secret.txt',
    '/foo/../bar.js',
    '/%2e%2e/%2e%2e/secret',
    '/foo/%2e%2e/%2e%2e/%2e%2e/bar',
  ]) {
    const resolved = resolveRendererFile(url(normalized), root)
    assert.ok(resolved === null || insideRoot(resolved), `escaped renderer root: ${resolved}`)
  }
})
