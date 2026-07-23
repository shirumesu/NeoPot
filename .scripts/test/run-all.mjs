import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const resultsRoot = path.join(repoRoot, 'test-results')
const budgets = JSON.parse(
  readFileSync(path.join(repoRoot, '.scripts', 'test', 'performance-budgets.json'), 'utf8'),
)
const npmExecPath = process.env.npm_execpath

if (!npmExecPath) {
  throw new Error('Run the local quality gate through `npm run test`.')
}

const steps = [
  ['Format', 'format:check'],
  ['Lint', 'lint'],
  ['Typecheck', 'typecheck'],
  ['Behavior coverage', 'test:coverage'],
  ['Static contracts', 'test:contracts'],
  ['Build', 'build'],
  ['Electron journeys', 'test:e2e'],
]
const runtimeMetricNames = [
  'coldStartToInteractive',
  'configNavigation',
  'configRoundTrip',
  'inputTranslateWindowReady',
  'firstTranslationReady',
]
const artifactPaths = ['out/main', 'out/preload', 'out/renderer', 'assets/models/ocr']

validateBudgetConfig()

mkdirSync(resultsRoot, { recursive: true })
const runtimeMetricsPath = path.join(resultsRoot, 'electron-metrics.json')
rmSync(runtimeMetricsPath, { force: true })

const commandMetrics = []
let failedStep = null
let exitCode = 0

for (const [name, script] of steps) {
  const startedAt = performance.now()
  const result = spawnSync(process.execPath, [npmExecPath, 'run', script], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })
  const durationMs = Math.round(performance.now() - startedAt)

  commandMetrics.push({
    name,
    durationMs,
    exitCode: result.status ?? 1,
    error: result.error?.message ?? null,
  })
  if (result.status !== 0) {
    failedStep = name
    exitCode = result.status ?? 1
    break
  }
}

const artifacts = artifactPaths.map((relativePath) => ({
  path: relativePath,
  bytes: directorySize(path.join(repoRoot, relativePath)),
}))

const runtimeMetrics = existsSync(runtimeMetricsPath)
  ? JSON.parse(readFileSync(runtimeMetricsPath, 'utf8'))
  : {}

if (exitCode === 0) {
  assertExactKeys('runtime metrics', runtimeMetrics, runtimeMetricNames)
}

const report = {
  generatedAt: new Date().toISOString(),
  passed: exitCode === 0,
  failedStep,
  commands: commandMetrics,
  runtime: runtimeMetrics,
  artifacts,
}

writeFileSync(path.join(resultsRoot, 'quality-report.json'), `${JSON.stringify(report, null, 2)}\n`)

printReport(report)
process.exitCode = exitCode

function directorySize(directoryPath) {
  if (!existsSync(directoryPath)) {
    return 0
  }

  let total = 0
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name)
    total += entry.isDirectory() ? directorySize(entryPath) : statSync(entryPath).size
  }
  return total
}

function printReport(report) {
  console.log('\nQuality and performance report')
  console.table(
    report.commands.map(({ name, durationMs, exitCode, error }) => ({
      Check: name,
      'Duration (ms)': durationMs,
      Status: exitCode === 0 ? 'pass' : 'fail',
      Error: error ?? '',
    })),
  )

  const runtimeRows = Object.entries(report.runtime).map(([name, value]) => ({
    Metric: name,
    'Duration (ms)': value,
  }))
  if (runtimeRows.length > 0) {
    console.table(runtimeRows)
  }

  console.table(
    report.artifacts.map(({ path: artifactPath, bytes }) => ({
      Artifact: artifactPath,
      Bytes: bytes,
      MiB: Number((bytes / 1024 / 1024).toFixed(2)),
    })),
  )

  for (const metric of report.commands) {
    warnIfOverBudget('command', metric.name, metric.durationMs, budgets.commandsMs[metric.name])
  }
  for (const [name, value] of Object.entries(report.runtime)) {
    warnIfOverBudget('runtime', name, value, budgets.runtimeMs[name])
  }
  for (const artifact of report.artifacts) {
    warnIfOverBudget(
      'artifact',
      artifact.path,
      artifact.bytes,
      budgets.artifactBytes[artifact.path],
    )
  }

  console.log(
    report.passed
      ? 'Complete local quality gate passed.'
      : `Local quality gate failed at: ${report.failedStep}.`,
  )
}

function warnIfOverBudget(kind, name, actual, budget) {
  if (typeof budget !== 'number' || actual <= budget) {
    return
  }

  const message = `${kind} ${name} exceeded its warning budget: ${actual} > ${budget}`
  console.warn(`WARNING: ${message}`)
}

function validateBudgetConfig() {
  assertExactKeys('performance budget groups', budgets, [
    'commandsMs',
    'runtimeMs',
    'artifactBytes',
  ])
  assertExactKeys(
    'command budgets',
    budgets.commandsMs,
    steps.map(([name]) => name),
  )
  assertExactKeys('runtime budgets', budgets.runtimeMs, runtimeMetricNames)
  assertExactKeys('artifact budgets', budgets.artifactBytes, artifactPaths)

  for (const [groupName, group] of Object.entries(budgets)) {
    for (const [name, value] of Object.entries(group)) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid ${groupName} budget for ${name}: ${String(value)}`)
      }
    }
  }
}

function assertExactKeys(label, value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }

  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(
      `${label} mismatch: expected [${expected.join(', ')}], received [${actual.join(', ')}].`,
    )
  }
}
