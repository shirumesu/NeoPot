import { app, Menu, nativeImage, Tray } from 'electron'
import { getTrayLabels } from '../../shared/trayLabels'
import { getAppIconPath } from './appIdentity'
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

  const labels = getTrayLabels(getConfig('app_language'))

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
