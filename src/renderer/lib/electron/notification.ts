export async function sendNotification(message: string | { title?: string; body?: string }) {
  const title = typeof message === 'string' ? 'NeoPot' : message.title || 'NeoPot'
  const body = typeof message === 'string' ? message : message.body || ''
  new Notification(title, { body })
}
