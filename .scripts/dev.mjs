import { spawn } from 'node:child_process'

const debugEnabled =
  process.argv.includes('--debug') ||
  process.env.npm_config_debug === 'true' ||
  process.env.ELECTRON_ENABLE_LOGGING === '1'

const command = process.platform === 'win32' ? 'cmd.exe' : 'electron-forge'
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'electron-forge start'] : ['start']

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(debugEnabled ? { ELECTRON_ENABLE_LOGGING: '1' } : {}),
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
