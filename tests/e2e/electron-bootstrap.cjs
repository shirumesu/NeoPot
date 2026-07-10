const path = require('node:path')
const { app } = require('electron')

const testRoot = process.env.NEOPOT_E2E_ROOT
if (!testRoot) {
  throw new Error('NEOPOT_E2E_ROOT is required for isolated Electron tests.')
}

const repoRoot = path.resolve(__dirname, '..', '..')
app.setAppPath(repoRoot)
app.setPath('userData', path.join(testRoot, 'userData'))
app.setPath('sessionData', path.join(testRoot, 'sessionData'))
app.setPath('appData', path.join(testRoot, 'appData'))
app.setPath('logs', path.join(testRoot, 'logs'))

require(path.join(repoRoot, 'out', 'main', 'index.cjs'))
