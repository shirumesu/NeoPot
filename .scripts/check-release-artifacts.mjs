import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const distRoot = path.join(repoRoot, 'dist')
const target = process.argv.includes('--win')
  ? 'win'
  : process.argv.includes('--linux')
    ? 'linux'
    : null
const skipSmoke = process.argv.includes('--skip-smoke')

if (!target) {
  throw new Error('Usage: node .scripts/check-release-artifacts.mjs --win|--linux')
}

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const version = escapeRegex(packageJson.version)
const files = existsSync(distRoot)
  ? readdirSync(distRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
  : []

const required =
  target === 'win'
    ? [
        new RegExp(`^NeoPot-Setup-${version}\\.exe$`),
        new RegExp(`^NeoPot-${version}-portable-x64\\.exe$`),
        new RegExp(`^NeoPot-Setup-${version}\\.exe\\.blockmap$`),
        /^latest\.yml$/,
      ]
    : [
        new RegExp(`^NeoPot-${version}-linux-x86_64\\.AppImage$`),
        new RegExp(`^NeoPot-${version}-linux-amd64\\.deb$`),
        new RegExp(`^NeoPot-${version}-linux-x86_64\\.rpm$`),
        /^latest-linux\.yml$/,
      ]

const missing = required.filter((pattern) => !files.some((file) => pattern.test(file)))
if (missing.length > 0) {
  throw new Error(
    `Missing ${target} release artifacts: ${missing.map((pattern) => pattern.source).join(', ')}`,
  )
}

const artifactRows = files
  .filter((file) => /\.(AppImage|blockmap|deb|exe|rpm|yml)$/.test(file))
  .map((file) => {
    const bytes = statSync(path.join(distRoot, file)).size
    return {
      Artifact: file,
      Bytes: bytes,
      MiB: Number((bytes / 1024 / 1024).toFixed(2)),
    }
  })

console.table(artifactRows)
for (const artifact of artifactRows) {
  if (artifact.Bytes > 300 * 1024 * 1024) {
    console.warn(
      `::warning title=Release artifact size::${artifact.Artifact} exceeds the 300 MiB warning budget.`,
    )
  }
}

if (target === 'win' && !skipSmoke) {
  await smokeWindowsExecutable()
}

console.log(`${target} release artifacts passed structural validation.`)

async function smokeWindowsExecutable() {
  if (process.platform !== 'win32') {
    throw new Error('The Windows packaged executable smoke must run on Windows.')
  }

  const executable = path.join(distRoot, 'win-unpacked', 'NeoPot.exe')
  if (!existsSync(executable)) {
    throw new Error('Missing dist/win-unpacked/NeoPot.exe for packaged startup smoke.')
  }

  const child = spawn(executable, [], {
    cwd: path.dirname(executable),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    stdio: 'ignore',
  })

  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ running: true }), 8_000)
    child.once('error', (error) => {
      clearTimeout(timer)
      resolve({ running: false, error })
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ running: false, code, signal })
    })
  })

  if (!outcome.running) {
    throw new Error(
      `Packaged NeoPot exited before the smoke window elapsed: ${JSON.stringify(outcome)}`,
    )
  }

  child.kill()
  console.log('Packaged NeoPot remained running for the 8 second startup smoke window.')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
