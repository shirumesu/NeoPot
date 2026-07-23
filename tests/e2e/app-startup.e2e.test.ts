import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import http, { type Server } from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

test('built application starts and completes a translation through the isolated Electron stack', async ({
  browserName: _browserName,
}, testInfo) => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'neopot-e2e-'))
  const port = await reservePort()
  const ollama = await startOllamaMock()
  const mainConsole: string[] = []
  const rendererConsole: string[] = []
  const pageErrors: string[] = []
  const startedAt = performance.now()
  let electronApp: ElectronApplication | undefined

  try {
    await prepareConfig(testRoot, port, ollama.origin)
    electronApp = await electron.launch({
      executablePath: electronPath as unknown as string,
      args: ['tests/e2e/electron-bootstrap.cjs'],
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        NEOPOT_E2E_ROOT: testRoot,
        ELECTRON_ENABLE_LOGGING: '1',
      },
    })
    electronApp.on('console', (message) => mainConsole.push(message.text()))

    const configWindow = await waitForWindow(electronApp, 'config')
    configWindow.on('console', (message) => {
      rendererConsole.push(`${message.type()}: ${message.text()}`)
    })
    configWindow.on('pageerror', (error) => {
      pageErrors.push(error.stack ?? error.message)
    })

    await configWindow.waitForLoadState('domcontentloaded')
    await expect(configWindow.locator('h2')).not.toHaveText('')
    const coldStartToInteractive = Math.round(performance.now() - startedAt)

    const bridge = await configWindow.evaluate(async () => ({
      exposed: Boolean(window.neoPot),
      label: await window.neoPot?.app.getWindowLabel(),
      version: await window.neoPot?.app.getVersion(),
    }))
    expect(bridge.exposed).toBe(true)
    expect(bridge.label).toBe('config')
    expect(bridge.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(configWindow.url()).toMatch(/^neopot:\/\/main_window\/index\.html\?window=config/)

    const sidebarButtons = configWindow.getByRole('navigation').getByRole('button')
    await expect(sidebarButtons).toHaveCount(7)
    const previousHeading = await configWindow.locator('h2').textContent()
    const navigationStartedAt = performance.now()
    await sidebarButtons.nth(6).click()
    await expect(configWindow.locator('h2')).not.toHaveText(previousHeading ?? '')
    const configNavigation = Math.round(performance.now() - navigationStartedAt)

    const configStartedAt = performance.now()
    const persistedProbe = await configWindow.evaluate(async () => {
      await window.neoPot.config.set('e2e_probe', { enabled: true })
      return await window.neoPot.config.get('e2e_probe')
    })
    const configRoundTrip = Math.round(performance.now() - configStartedAt)
    expect(persistedProbe).toEqual({ enabled: true })

    const inputTranslateStartedAt = performance.now()
    await configWindow.evaluate(async () => {
      await window.neoPot.workflow.inputTranslate()
    })
    const translateWindow = await waitForWindow(electronApp, 'translate')
    translateWindow.on('console', (message) => {
      rendererConsole.push(`${message.type()}: ${message.text()}`)
    })
    translateWindow.on('pageerror', (error) => {
      pageErrors.push(error.stack ?? error.message)
    })
    await translateWindow.waitForLoadState('domcontentloaded')
    await expect.poll(() => translateWindow.evaluate(() => Boolean(window.neoPot))).toBe(true)
    await expect
      .poll(() =>
        mainConsole.some((message) => message.includes('Window renderer ready. window=translate')),
      )
      .toBe(true)
    const inputTranslateWindowReady = Math.round(performance.now() - inputTranslateStartedAt)

    const sourceTextArea = translateWindow.locator('textarea:not([readonly])').first()
    const targetTextArea = translateWindow.locator('textarea[readonly]').first()
    await expect(sourceTextArea).toBeVisible()

    const firstTranslationStartedAt = performance.now()
    await sourceTextArea.fill('hello from the Electron journey')
    await expect(targetTextArea).toHaveValue('端到端_', { timeout: 10_000 })
    await expect(targetTextArea).toHaveValue('端到端翻译成功', { timeout: 10_000 })
    const firstTranslationReady = Math.round(performance.now() - firstTranslationStartedAt)

    expect(ollama.requests).toHaveLength(1)
    expect(ollama.requests[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/api/chat',
        body: expect.objectContaining({
          model: 'neopot-e2e',
          stream: true,
          messages: [
            {
              role: 'user',
              content:
                'Translate hello from the Electron journey from English to Simplified Chinese',
            },
          ],
        }),
      }),
    )

    await sourceTextArea.fill('force provider failure')
    await sourceTextArea.press('Enter')
    await expect.poll(() => ollama.requests.length).toBe(2)
    await expect(
      translateWindow.getByRole('paragraph').filter({
        hasText: 'Error: Ollama chat failed with HTTP 503: upstream unavailable',
      }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(targetTextArea).toHaveValue('')

    const mainState = await electronApp.evaluate(({ app, BrowserWindow }) => ({
      userData: app.getPath('userData'),
      appData: app.getPath('appData'),
      windows: BrowserWindow.getAllWindows().map((window) => {
        const preferences = window.webContents.getLastWebPreferences()
        return {
          url: window.webContents.getURL(),
          contextIsolation: preferences.contextIsolation,
          nodeIntegration: preferences.nodeIntegration,
          sandbox: preferences.sandbox,
        }
      }),
    }))

    expect(path.resolve(mainState.userData)).toBe(path.resolve(testRoot, 'userData'))
    expect(path.resolve(mainState.appData)).toBe(path.resolve(testRoot, 'appData'))
    expect(mainState.windows).toContainEqual(
      expect.objectContaining({
        url: expect.stringMatching(/^neopot:\/\/main_window\/index\.html\?window=config/),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      }),
    )
    expect(pageErrors).toEqual([])

    await mkdir('test-results', { recursive: true })
    await writeFile(
      'test-results/electron-metrics.json',
      `${JSON.stringify(
        {
          coldStartToInteractive,
          configNavigation,
          configRoundTrip,
          inputTranslateWindowReady,
          firstTranslationReady,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await testInfo.attach('electron-main-console', {
      body: Buffer.from(mainConsole.join('\n')),
      contentType: 'text/plain',
    })
    await testInfo.attach('electron-renderer-console', {
      body: Buffer.from(rendererConsole.join('\n')),
      contentType: 'text/plain',
    })
    await electronApp?.close().catch(() => undefined)
    await closeServer(ollama.server)
    await rm(testRoot, { recursive: true, force: true })
  }
})

async function waitForWindow(
  electronApp: ElectronApplication,
  expectedLabel: string,
): Promise<Page> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    for (const page of electronApp.windows()) {
      const label = await page
        .evaluate(async () => window.neoPot?.app.getWindowLabel())
        .catch(() => null)
      if (label === expectedLabel) {
        return page
      }
    }

    await Promise.race([
      electronApp.waitForEvent('window', { timeout: 500 }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ])
  }

  throw new Error(`${expectedLabel} window did not become ready within 15 seconds.`)
}

async function prepareConfig(testRoot: string, port: number, ollamaOrigin: string): Promise<void> {
  const userData = path.join(testRoot, 'userData')
  await mkdir(userData, { recursive: true })
  await writeFile(
    path.join(userData, 'config.json'),
    `${JSON.stringify(
      {
        check_update: false,
        clipboard_monitor: false,
        close_to_tray: false,
        dynamic_translate: true,
        translate_source_language: 'en',
        translate_target_language: 'zh_cn',
        translate_auto_copy: 'disable',
        translate_hide_window: false,
        translate_service_list: ['ollama'],
        recognize_service_list: ['local_model'],
        tts_service_list: [],
        ollama: {
          enable: true,
          model: 'neopot-e2e',
          requestPath: ollamaOrigin,
          stream: true,
          promptList: [
            {
              role: 'user',
              content: 'Translate $text from $from to $to',
            },
          ],
        },
        server_port: port,
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    path.join(userData, 'migration.json'),
    `${JSON.stringify({ status: 'already-migrated' }, null, 2)}\n`,
  )
}

interface OllamaRequestRecord {
  method: string | undefined
  url: string | undefined
  body: Record<string, unknown>
}

async function startOllamaMock(): Promise<{
  origin: string
  requests: OllamaRequestRecord[]
  server: Server
}> {
  const requests: OllamaRequestRecord[] = []
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8')
      const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
      requests.push({ method: request.method, url: request.url, body })

      const failed = rawBody.includes('force provider failure')
      response.statusCode = failed ? 503 : 200
      if (failed) {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ error: { message: 'upstream unavailable' } }))
        return
      }

      response.setHeader('Content-Type', 'application/x-ndjson')
      response.write(`${JSON.stringify({ message: { content: '端到端' } })}\n`)
      setTimeout(() => {
        response.end(`${JSON.stringify({ message: { content: '翻译成功' } })}\n`)
      }, 300)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    await closeServer(server)
    throw new Error('Unable to start the Ollama E2E mock server.')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    server,
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections?.()
  })
}

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to reserve a local test port.'))
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(address.port)
        }
      })
    })
  })
}
