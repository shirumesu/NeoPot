import type { OpenDialogOptions } from '@/shared/types/electron-api'

export async function openDialog(options?: OpenDialogOptions) {
  return window.neoPot.dialog.open(options)
}
