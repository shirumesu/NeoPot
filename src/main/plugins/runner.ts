import { createPluginSandbox, disposePluginSandbox } from './sandbox-window'

export interface PluginRunOptions {
  trusted?: boolean
  timeoutMs?: number
}

export interface PluginResult {
  status: 'ok' | 'unsupported'
  value?: unknown
}

export async function runPlugin(
  type: string,
  name: string,
  input: unknown,
  options: PluginRunOptions = {},
): Promise<PluginResult> {
  if (options.trusted) {
    return runTrustedPluginHelper(type, name, input, options)
  }

  const timeoutMs = options.timeoutMs ?? 10000
  const sandbox = createPluginSandbox(`${type}:${name}`)
  const timeout = setTimeout(() => {
    disposePluginSandbox(sandbox)
  }, timeoutMs)

  try {
    return {
      status: 'unsupported',
      value: 'PLUGIN_SECURE_RUNNER_NOT_IMPLEMENTED',
    }
  } catch (error) {
    return {
      status: 'unsupported',
      value: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
    disposePluginSandbox(sandbox)
  }
}

export async function runTrustedPluginHelper(
  _type: string,
  _name: string,
  _input: unknown,
  options: PluginRunOptions = {},
): Promise<PluginResult> {
  if (!options.trusted) {
    throw new Error('PLUGIN_TRUST_REQUIRED')
  }

  if ((options.timeoutMs ?? 10000) <= 0) {
    throw new Error('PLUGIN_TIMEOUT')
  }

  return {
    status: 'unsupported',
    value: 'PLUGIN_TRUSTED_RUNNER_NOT_IMPLEMENTED',
  }
}
