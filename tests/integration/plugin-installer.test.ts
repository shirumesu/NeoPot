import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  PluginInstallError,
  createPluginInstallerCore,
} from '../../src/main/plugins/pluginInstallerCore'

let tempDir: string
let pluginRoot: string

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'neopot-plugin-test-'))
  pluginRoot = path.join(tempDir, 'plugins')
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

async function createPluginDirectory(
  name: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = { 'main.js': 'export default () => "ok"' },
) {
  const source = path.join(tempDir, name)
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'info.json'), JSON.stringify(manifest), 'utf8')
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(source, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
  }
  return source
}

function createZip(name: string, entries: Record<string, string>): string {
  const zipPath = path.join(tempDir, name)
  const zip = new AdmZip()
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.from(content, 'utf8'))
  }
  zip.writeZip(zipPath)
  return zipPath
}

async function rewriteZipEntryName(zipPath: string, from: string, to: string) {
  const archive = await readFile(zipPath)
  const source = Buffer.from(from, 'utf8')
  const replacement = Buffer.from(to, 'utf8')
  if (source.byteLength !== replacement.byteLength) {
    throw new Error('ZIP entry replacements must have equal byte lengths.')
  }

  let offset = archive.indexOf(source)
  while (offset !== -1) {
    replacement.copy(archive, offset)
    offset = archive.indexOf(source, offset + replacement.byteLength)
  }
  await writeFile(zipPath, archive)
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
}

function expectInstallError(promise: Promise<unknown>, code: PluginInstallError['code']) {
  return expect(promise).rejects.toMatchObject({
    name: 'PluginInstallError',
    code,
  })
}

describe('plugin installer core', () => {
  test('installs a valid source directory with files and local source metadata', async () => {
    const source = await createPluginDirectory(
      'source-plugin',
      {
        plugin_type: 'translate',
        name: 'demo_plugin',
        version: '1.0.0',
      },
      {
        'main.js': 'export default () => "directory"',
        'assets/dictionary.txt': 'word',
      },
    )
    const installer = createPluginInstallerCore({ pluginRoot, now: () => 1234 })

    await expect(
      installer.installFromDirectory(source, {
        installSource: source,
        installSourceType: 'local',
      }),
    ).resolves.toEqual({ status: 'installed', type: 'translate', name: 'demo_plugin' })

    const installed = path.join(pluginRoot, 'translate', 'demo_plugin')
    expect(await readFile(path.join(installed, 'main.js'), 'utf8')).toContain('directory')
    expect(await readFile(path.join(installed, 'assets', 'dictionary.txt'), 'utf8')).toBe('word')
    expect(await readJson(path.join(installed, '.neopot-plugin.json'))).toEqual({
      installSource: source,
      installSourceType: 'local',
      installedAt: 1234,
    })
  })

  test('installs a valid zip with URL source metadata', async () => {
    const zipPath = createZip('demo.zip', {
      'info.json': JSON.stringify({
        plugin_type: 'recognize',
        name: 'demo_zip',
        version: '2.0.0',
      }),
      'main.js': 'export default () => "zip"',
      'assets/model.txt': 'model',
    })
    const installer = createPluginInstallerCore({ pluginRoot, now: () => 5678 })

    await expect(
      installer.installFromZip(zipPath, {
        installSource: 'https://plugins.example.test/demo.zip',
        installSourceType: 'url',
      }),
    ).resolves.toEqual({ status: 'installed', type: 'recognize', name: 'demo_zip' })

    const installed = path.join(pluginRoot, 'recognize', 'demo_zip')
    expect(await readFile(path.join(installed, 'main.js'), 'utf8')).toContain('zip')
    expect(await readFile(path.join(installed, 'assets', 'model.txt'), 'utf8')).toBe('model')
    expect(await readJson(path.join(installed, '.neopot-plugin.json'))).toEqual({
      installSource: 'https://plugins.example.test/demo.zip',
      installSourceType: 'url',
      installedAt: 5678,
    })
  })

  test('rejects directory and zip packages missing required root files', async () => {
    const missingInfo = path.join(tempDir, 'missing-info')
    await mkdir(missingInfo)
    await writeFile(path.join(missingInfo, 'main.js'), 'export default 1', 'utf8')
    const missingMain = createZip('missing-main.zip', {
      'info.json': JSON.stringify({ plugin_type: 'translate', name: 'missing_main' }),
    })
    const installer = createPluginInstallerCore({ pluginRoot })

    await expectInstallError(
      installer.installFromDirectory(missingInfo, {
        installSource: missingInfo,
        installSourceType: 'local',
      }),
      'PLUGIN_INVALID_PACKAGE',
    )
    await expectInstallError(
      installer.installFromZip(missingMain, {
        installSource: missingMain,
        installSourceType: 'local',
      }),
      'PLUGIN_INVALID_PACKAGE',
    )
  })

  test('rejects invalid manifest identity before it can escape the plugin root', async () => {
    const source = await createPluginDirectory('escape-source', {
      plugin_type: 'translate',
      name: '../escaped',
      version: '1.0.0',
    })
    const installer = createPluginInstallerCore({ pluginRoot })

    await expectInstallError(
      installer.installFromDirectory(source, {
        installSource: source,
        installSourceType: 'local',
      }),
      'PLUGIN_INVALID_PACKAGE',
    )
    await expect(readFile(path.join(tempDir, 'escaped', 'main.js'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  test('rejects zip entries that traverse outside the temporary install directory', async () => {
    const zipPath = createZip('zip-slip.zip', {
      'info.json': JSON.stringify({ plugin_type: 'translate', name: 'safe_name' }),
      'main.js': 'export default 1',
      'aa/escaped.txt': 'escaped',
    })
    await rewriteZipEntryName(zipPath, 'aa/escaped.txt', '../escaped.txt')
    const installer = createPluginInstallerCore({ pluginRoot })

    await expectInstallError(
      installer.installFromZip(zipPath, {
        installSource: zipPath,
        installSourceType: 'local',
      }),
      'PLUGIN_ZIP_SLIP',
    )
    await expect(
      readFile(path.join(pluginRoot, 'translate', 'escaped.txt'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readFile(path.join(pluginRoot, 'translate', 'safe_name', 'main.js'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('reinstall replaces stale files and records the new install source', async () => {
    const source = await createPluginDirectory(
      'version-one',
      { plugin_type: 'tts', name: 'replace_me', version: '1.0.0' },
      {
        'main.js': 'export default () => "v1"',
        'stale.txt': 'remove me',
      },
    )
    let timestamp = 100
    const installer = createPluginInstallerCore({ pluginRoot, now: () => timestamp })
    await installer.installFromDirectory(source, {
      installSource: source,
      installSourceType: 'local',
    })

    timestamp = 200
    const updateZip = createZip('version-two.zip', {
      'info.json': JSON.stringify({ plugin_type: 'tts', name: 'replace_me', version: '2.0.0' }),
      'main.js': 'export default () => "v2"',
      'fresh.txt': 'new file',
    })
    await installer.installFromZip(updateZip, {
      installSource: 'https://plugins.example.test/version-two.zip',
      installSourceType: 'url',
    })

    const installed = path.join(pluginRoot, 'tts', 'replace_me')
    expect(await readFile(path.join(installed, 'main.js'), 'utf8')).toContain('v2')
    expect(await readFile(path.join(installed, 'fresh.txt'), 'utf8')).toBe('new file')
    await expect(readFile(path.join(installed, 'stale.txt'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(await readJson(path.join(installed, '.neopot-plugin.json'))).toEqual({
      installSource: 'https://plugins.example.test/version-two.zip',
      installSourceType: 'url',
      installedAt: 200,
    })
  })
})
