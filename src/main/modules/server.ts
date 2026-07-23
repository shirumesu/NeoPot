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
import { createLocalServer, DEFAULT_LOCAL_SERVER_PORT } from './localServer'

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

export function startServer(port = DEFAULT_LOCAL_SERVER_PORT): void {
  localServer.start(port)
}

export function stopServer(): void {
  localServer.stop()
}
