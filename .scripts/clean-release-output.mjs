import { rm } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const generatedPaths = [resolve(projectRoot, 'dist'), resolve(projectRoot, 'out', 'package')]

function assertGeneratedPath(targetPath) {
  const relativePath = relative(projectRoot, targetPath).replace(/\\/g, '/')
  if (relativePath !== 'dist' && relativePath !== 'out/package') {
    throw new Error(`Refusing to remove unexpected path: ${targetPath}`)
  }
}

for (const targetPath of generatedPaths) {
  assertGeneratedPath(targetPath)
  await rm(targetPath, { recursive: true, force: true })
}
