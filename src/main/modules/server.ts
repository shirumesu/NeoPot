import { logger } from '../logger'
import {
  imageTranslate,
  inputTranslate,
  ocrRecognize,
  ocrTranslate,
  openConfig,
  recognizeWindow,
  selectionTranslate,
  textTranslate,
} from './workflow'
import { createLocalServer } from './localServer'

const localServer = createLocalServer({
  actions: {
    imageTranslate,
    inputTranslate,
    ocrRecognize,
    ocrTranslate,
    openConfig,
    recognizeWindow,
    selectionTranslate,
    textTranslate,
  },
  logger,
})

export function startServer(port = 60828): void {
  localServer.start(port)
}

export function stopServer(): void {
  localServer.stop()
}
