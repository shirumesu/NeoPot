import { existsSync } from 'node:fs'
import path from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import enUS from '../../renderer/i18n/locales/en_US.json'
import zhCN from '../../renderer/i18n/locales/zh_CN.json'
import zhTW from '../../renderer/i18n/locales/zh_TW.json'
import { getConfig } from './config'
import {
  inputTranslate,
  ocrRecognize,
  ocrTranslate,
  openConfig,
  selectionTranslate,
} from './workflow'

let tray: Tray | null = null

const resources = {
  en: enUS.translation,
  en_us: enUS.translation,
  zh_cn: zhCN.translation,
  zh_tw: zhTW.translation,
}

const fallbackLabels = {
  config: 'Config',
  selectionTranslate: 'Selection Translate',
  inputTranslate: 'Input Translate',
  ocrRecognize: 'OCR Recognize',
  ocrTranslate: 'OCR Translate',
  restart: 'Restart',
  quit: 'Quit',
}

const extraLabels: Record<string, Partial<typeof fallbackLabels>> = {
  zh_cn: {
    config: '偏好设置',
    restart: '重启',
    quit: '退出',
  },
  zh_tw: {
    config: '偏好設定',
    restart: '重新啟動',
    quit: '結束',
  },
}

async function dispatchTrayConfiguredAction(): Promise<void> {
  const action = getConfig('tray_click_event')

  switch (action) {
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

function getAppLanguage(): keyof typeof resources {
  const language = getConfig('app_language')
  if (typeof language !== 'string') {
    return 'en'
  }

  const normalized = language.toLowerCase().replace('-', '_') as keyof typeof resources
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

function getLabels(): typeof fallbackLabels {
  const language = getAppLanguage()
  const resource = resources[language]

  return {
    config:
      extraLabels[language]?.config ??
      getNestedValue(resource, ['config', 'general', 'event', 'config']) ??
      fallbackLabels.config,
    selectionTranslate:
      getNestedValue(resource, ['config', 'hotkey', 'selection_translate']) ??
      fallbackLabels.selectionTranslate,
    inputTranslate:
      getNestedValue(resource, ['config', 'hotkey', 'input_translate']) ??
      fallbackLabels.inputTranslate,
    ocrRecognize:
      getNestedValue(resource, ['config', 'hotkey', 'ocr_recognize']) ??
      fallbackLabels.ocrRecognize,
    ocrTranslate:
      getNestedValue(resource, ['config', 'hotkey', 'ocr_translate']) ??
      fallbackLabels.ocrTranslate,
    restart: extraLabels[language]?.restart ?? fallbackLabels.restart,
    quit: extraLabels[language]?.quit ?? fallbackLabels.quit,
  }
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
