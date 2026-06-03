import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip')

const repoRoot = path.resolve(import.meta.dirname, '..')
const pluginsRoot = path.join(repoRoot, 'plugins')

function toZipPath(filePath) {
  return filePath.split(path.sep).join('/')
}

function collectFiles(directory, root = directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, root))
      continue
    }

    if (!entry.isFile() || entry.name.toLowerCase().endsWith('.zip')) {
      continue
    }

    files.push({
      absolutePath: fullPath,
      archivePath: toZipPath(path.relative(root, fullPath)),
    })
  }

  return files
}

function isPackablePlugin(directory) {
  return (
    statSync(directory).isDirectory() &&
    existsSync(path.join(directory, 'info.json')) &&
    existsSync(path.join(directory, 'main.js'))
  )
}

if (!existsSync(pluginsRoot)) {
  throw new Error(`Plugins directory does not exist: ${pluginsRoot}`)
}

const pluginDirs = readdirSync(pluginsRoot)
  .map((name) => path.join(pluginsRoot, name))
  .filter(isPackablePlugin)

if (pluginDirs.length === 0) {
  console.log('No packable plugins found.')
  process.exit(0)
}

for (const pluginDir of pluginDirs) {
  const pluginName = path.basename(pluginDir)
  const zipPath = path.join(pluginDir, `${pluginName}.zip`)
  const zip = new AdmZip()
  const files = collectFiles(pluginDir)

  for (const file of files) {
    zip.addFile(file.archivePath, readFileSync(file.absolutePath))
  }

  zip.writeZip(zipPath)
  console.log(`Packed ${path.relative(repoRoot, zipPath)} (${files.length} files)`)
}
