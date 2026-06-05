import { existsSync } from 'node:fs'
import path from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { translationResources as resources } from '../../renderer/i18n/resources'
import { getConfig } from './config'
import {
  inputTranslate,
  ocrRecognize,
  ocrTranslate,
  openConfig,
  openTranslate,
  selectionTranslate,
} from './workflow'

let tray: Tray | null = null

const fallbackLanguageChains: Record<string, string[]> = {
  zh_cn: ['zh_tw', 'en'],
  zh_tw: ['zh_cn', 'en'],
}

const trayLabelPaths = {
  config: ['tray', 'config'],
  selectionTranslate: ['tray', 'selection_translate'],
  inputTranslate: ['tray', 'input_translate'],
  ocrRecognize: ['tray', 'ocr_recognize'],
  ocrTranslate: ['tray', 'ocr_translate'],
  restart: ['tray', 'restart'],
  quit: ['tray', 'quit'],
} as const

type TrayLabelKey = keyof typeof trayLabelPaths

async function dispatchTrayConfiguredAction(): Promise<void> {
  const action = getConfig('tray_click_event')

  switch (action) {
    case 'disable':
      break
    case 'translate':
      await openTranslate()
      break
    case 'selection_translate':
      await selectionTranslate()
      break
    case 'input_translate':
      await inputTranslate()
      break
    case 'ocr_recognize':
      await ocrRecognize()
      break
    case 'ocr_translate':
      await ocrTranslate()
      break
    case 'config':
    default:
      await openConfig()
      break
  }
}

function getAppIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function getAppLanguage(): string {
  const language = getConfig('app_language')
  if (typeof language !== 'string') {
    return 'en'
  }

  const normalized = language.toLowerCase().replace('-', '_')
  return normalized in resources ? normalized : 'en'
}

function getNestedValue(source: unknown, pathSegments: string[]): string | undefined {
  let cursor = source
  for (const segment of pathSegments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      return undefined
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }

  return typeof cursor === 'string' ? cursor : undefined
}

function getFallbackLanguages(language: string): string[] {
  return [language, ...(fallbackLanguageChains[language] ?? ['en'])].filter(
    (candidate, index, candidates) =>
      candidate in resources && candidates.indexOf(candidate) === index,
  )
}

function translateTrayLabel(language: string, pathSegments: readonly string[]): string {
  for (const candidate of getFallbackLanguages(language)) {
    const label = getNestedValue(resources[candidate], [...pathSegments])
    if (label) {
      return label
    }
  }

  return pathSegments.join('.')
}

function getLabels(): Record<TrayLabelKey, string> {
  const language = getAppLanguage()

  return Object.fromEntries(
    Object.entries(trayLabelPaths).map(([key, pathSegments]) => [
      key,
      translateTrayLabel(language, pathSegments),
    ]),
  ) as Record<TrayLabelKey, string>
}

export function setupTray(): void {
  if (tray) {
    return
  }

  const icon = nativeImage.createFromPath(getAppIconPath())
  tray = new Tray(icon)
  tray.setToolTip('NeoPot')
  tray.on('click', () => void dispatchTrayConfiguredAction())
  updateTrayMenu()
}

export function updateTrayMenu(): void {
  if (!tray) {
    return
  }

  const labels = getLabels()

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: labels.config,
        click: () => void openConfig(),
      },
      {
        label: labels.selectionTranslate,
        click: () => void selectionTranslate(),
      },
      {
        label: labels.inputTranslate,
        click: () => void inputTranslate(),
      },
      {
        label: labels.ocrRecognize,
        click: () => void ocrRecognize(),
      },
      {
        label: labels.ocrTranslate,
        click: () => void ocrTranslate(),
      },
      { type: 'separator' },
      {
        label: labels.restart,
        click: () => {
          app.relaunch()
          app.exit(0)
        },
      },
      {
        label: labels.quit,
        click: () => app.quit(),
      },
    ]),
  )
}
