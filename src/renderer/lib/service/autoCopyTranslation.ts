export type TranslationAutoCopyMode = 'disable' | 'source' | 'target' | 'source_target'

interface AutoCopyTranslationOptions {
  mode: TranslationAutoCopyMode
  targetIndex: number
  clipboardMonitor: boolean
  hideWindow: boolean
  sourceText: string
  targetText: string
  writeText: (text: string) => Promise<void>
  notify: (text: string) => void
}

export async function autoCopyTranslation({
  mode,
  targetIndex,
  clipboardMonitor,
  hideWindow,
  sourceText,
  targetText,
  writeText,
  notify,
}: AutoCopyTranslationOptions): Promise<void> {
  if (targetIndex !== 0 || clipboardMonitor) {
    return
  }

  const clipboardText =
    mode === 'target'
      ? targetText
      : mode === 'source_target'
        ? `${sourceText}\n\n${targetText}`
        : null

  if (clipboardText === null) {
    return
  }

  await writeText(clipboardText)
  if (hideWindow) {
    notify(clipboardText)
  }
}
