import { Notification } from 'electron'
import { logger } from '../logger'

export interface NotificationOptions {
  silent?: boolean
}

export function showNotification(
  title: string,
  body: string,
  options: NotificationOptions = {},
): void {
  try {
    if (!Notification.isSupported()) {
      return
    }

    new Notification({
      title,
      body,
      silent: options.silent,
    }).show()
  } catch (error) {
    logger.warn('Notification failed.', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
