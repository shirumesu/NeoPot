import { Notification } from 'electron'
import log from 'electron-log/main'

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
    log.warn('Notification failed:', error)
  }
}
