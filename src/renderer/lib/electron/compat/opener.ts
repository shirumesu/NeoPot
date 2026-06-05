export async function openUrl(url: string) {
  if (!url) {
    return
  }

  if (window.neoPot?.command) {
    await window.neoPot.command.invoke('open_url', { url })
  }
}

export async function openPath(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}
