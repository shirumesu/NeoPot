export async function writeClipboardText(text: string) {
  await navigator.clipboard.writeText(text)
}
