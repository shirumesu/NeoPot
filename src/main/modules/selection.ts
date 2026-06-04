import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { clipboard } from 'electron'
import { logger } from '../logger'

const execFileAsync = promisify(execFile)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function tryExecFile(file: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      windowsHide: true,
      timeout: 1000,
    })
    const text = stdout.trim()
    return text === '' ? null : text
  } catch {
    return null
  }
}

async function readLinuxPrimarySelection(): Promise<string | null> {
  return (
    (await tryExecFile('wl-paste', ['--primary', '--no-newline'])) ??
    (await tryExecFile('xclip', ['-selection', 'primary', '-out'])) ??
    (await tryExecFile('xsel', ['--primary', '--output']))
  )
}

async function sendLinuxCopyKeystroke(): Promise<void> {
  for (const [command, args] of [
    ['xdotool', ['key', 'ctrl+c']],
    ['wtype', ['-M', 'ctrl', 'c', '-m', 'ctrl']],
  ] as const) {
    try {
      await execFileAsync(command, args, {
        windowsHide: true,
        timeout: 1000,
      })
      return
    } catch {
      // Try the next common desktop helper.
    }
  }

  logger.warn('No supported Linux selection copy helper was available.')
}

async function sendCopyKeystroke(): Promise<void> {
  if (process.platform === 'linux') {
    await sendLinuxCopyKeystroke()
    return
  }

  if (process.platform !== 'win32') {
    return
  }

  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
    ],
    {
      windowsHide: true,
      timeout: 2000,
    },
  )
}

export async function readSelectedText(): Promise<string> {
  if (process.platform === 'linux') {
    const primarySelection = await readLinuxPrimarySelection()
    if (primarySelection) {
      return primarySelection
    }
  }

  const previousText = clipboard.readText()
  const marker = `__NEOPOT_SELECTION_${Date.now()}__`

  try {
    clipboard.writeText(marker)
    await sendCopyKeystroke()
    await delay(120)
    const selectedText = clipboard.readText()
    return selectedText === marker ? '' : selectedText
  } finally {
    if (previousText !== clipboard.readText()) {
      clipboard.writeText(previousText)
    }
  }
}
