import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const expectedTag = `v${packageJson.version}`

function exactTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--exact-match'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const currentTag = exactTag()
if (currentTag !== expectedTag) {
  throw new Error(
    `Release version mismatch: package.json is ${packageJson.version}, but HEAD tag is ${currentTag || 'missing'}. Expected ${expectedTag}.`,
  )
}
