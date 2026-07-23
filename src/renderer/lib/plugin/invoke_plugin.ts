import { FileBase, readBinaryFile, readTextFile } from '@/renderer/lib/electron/files'
import {
  getAppCacheDirectory,
  getAppConfigDirectory,
  joinPath,
} from '@/renderer/lib/electron/paths'
import { invokeCommand, type RunBinaryArgs } from '@/renderer/lib/electron/command'
import { osType } from '../config/env'
import * as http from '@/renderer/lib/electron/http'
import { createPluginLogger } from '@/renderer/lib/logger'
import { getStoreValue } from '../config/store'
import type { FsOptions } from '@/shared/types/electron-api'

type HostCallback = (...args: unknown[]) => unknown

interface SandboxRequest {
  channel: 'neopot-plugin-rpc'
  pluginId: string
  requestId: string
  method: string
  args: unknown[]
}

interface SandboxCallResult {
  channel: 'neopot-plugin-result'
  pluginId: string
  requestId: string
  ok: boolean
  value?: unknown
  error?: string
}

interface PluginSandbox {
  pluginId: string
  frame: HTMLIFrameElement
  ready: Promise<void>
}

interface SerializableHttpResponse {
  ok: boolean
  status: number
  statusText: string
  headers?: Headers | Record<string, unknown>
  data?: unknown
  json?: () => Promise<unknown>
}

const sandboxMap = new Map<string, PluginSandbox>()
const pendingCalls = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }
>()
const callbackMap = new Map<string, HostCallback>()

let nextRequestId = 0
let messageListenerAttached = false

function createRequestId(): string {
  nextRequestId += 1
  return `${Date.now()}-${nextRequestId}`
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.slice(index, index + 8192))
  }
  return btoa(binary)
}

function decodeResponseBody(data: unknown): unknown {
  return data
}

function logContext(value: unknown): { valueType: string; value?: string; keys?: number } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      valueType: 'object',
      keys: Object.keys(value).length,
    }
  }

  return {
    valueType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
    value: value === undefined ? undefined : String(value),
  }
}

async function serializeHttpResponse(response: SerializableHttpResponse, responseType?: number) {
  const headers =
    response.headers instanceof Headers
      ? Object.fromEntries(response.headers.entries())
      : response.headers || {}
  const responseData = response.data ?? (response.json ? await response.json() : undefined)
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers,
    data:
      responseType === 3 && responseData instanceof ArrayBuffer
        ? Array.from(new Uint8Array(responseData))
        : decodeResponseBody(responseData),
    responseType,
  }
}

async function handleSandboxRequest(message: SandboxRequest): Promise<void> {
  const { pluginId, requestId, method, args } = message
  const sandbox = sandboxMap.get(pluginId)
  if (!sandbox?.frame.contentWindow) {
    return
  }

  try {
    let value: unknown
    switch (method) {
      case 'httpFetch':
        value = await serializeHttpResponse(
          await http.fetch(args[0] as string, args[1] ?? {}),
          (args[1] as { responseType?: number } | undefined)?.responseType,
        )
        break
      case 'readFile':
        value = Array.from(
          await readBinaryFile(String(args[0] ?? ''), args[1] as FsOptions | undefined),
        )
        break
      case 'readTextFile':
        value = await readTextFile(String(args[0] ?? ''), args[1] as FsOptions | undefined)
        break
      case 'run':
        value = await invokeCommand('run_binary', args[0] as RunBinaryArgs)
        break
      case 'openUrl':
        value = await invokeCommand('open_url', { url: String(args[0] ?? '') })
        break
      case 'hostCallback': {
        const callback = callbackMap.get(String(args[0] ?? ''))
        if (!callback) {
          throw new Error('Plugin callback is no longer available.')
        }
        value = await callback(...args.slice(1))
        break
      }
      case 'log': {
        const [level, context] = args as [string, unknown]
        const logger = createPluginLogger({
          pluginType: pluginId.split(':')[0],
          pluginName: pluginId.split(':')[1],
        })
        if (level === 'error') logger.error('Plugin log.', context)
        else if (level === 'warn') logger.warn('Plugin log.', logContext(context))
        else if (level === 'info') logger.info('Plugin log.', logContext(context))
        else logger.debug('Plugin log.', logContext(context))
        value = undefined
        break
      }
      default:
        throw new Error(`Unsupported plugin RPC method: ${method}`)
    }

    sandbox.frame.contentWindow.postMessage(
      {
        channel: 'neopot-plugin-rpc-result',
        pluginId,
        requestId,
        ok: true,
        value,
      },
      '*',
    )
  } catch (error) {
    sandbox.frame.contentWindow.postMessage(
      {
        channel: 'neopot-plugin-rpc-result',
        pluginId,
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      '*',
    )
  }
}

function attachMessageListener(): void {
  if (messageListenerAttached) {
    return
  }

  messageListenerAttached = true
  window.addEventListener('message', (event) => {
    const data = event.data
    if (!data || typeof data !== 'object') {
      return
    }

    if (data.channel === 'neopot-plugin-rpc') {
      const request = data as SandboxRequest
      if (sandboxMap.get(request.pluginId)?.frame.contentWindow === event.source) {
        void handleSandboxRequest(request)
      }
      return
    }

    if (data.channel !== 'neopot-plugin-result') {
      return
    }

    const result = data as SandboxCallResult
    if (sandboxMap.get(result.pluginId)?.frame.contentWindow !== event.source) {
      return
    }
    const pending = pendingCalls.get(result.requestId)
    if (!pending) {
      return
    }

    pendingCalls.delete(result.requestId)
    if (result.ok) {
      pending.resolve(result.value)
    } else {
      pending.reject(new Error(result.error || 'Plugin execution failed.'))
    }
  })
}

function sandboxHtml(pluginId: string, pluginType: string, pluginSource: string): string {
  const moduleSource = `${pluginSource}\nexport const __neopot_entry = typeof ${pluginType} !== 'undefined' ? ${pluginType} : undefined;\n`
  const encodedSource = encodeBase64(moduleSource)
  const encodedPluginId = JSON.stringify(pluginId)
  const encodedPluginType = JSON.stringify(pluginType)

  return `<!doctype html>
<meta charset="utf-8">
<script type="module">
const pluginId = ${encodedPluginId};
const pluginType = ${encodedPluginType};
const pending = new Map();
let nextRequestId = 0;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function rpc(method, ...args) {
  const requestId = String(++nextRequestId);
  parent.postMessage({ channel: 'neopot-plugin-rpc', pluginId, requestId, method, args }, '*');
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
  });
}

function revive(value) {
  if (Array.isArray(value)) {
    return value.map(revive);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value.__neopot_utils === true) {
    return {
      ...utils,
      cacheDir: value.cacheDir || '',
      pluginDir: value.pluginDir || '',
      pluginOptions: value.pluginOptions || {},
      osType: value.osType || '',
    };
  }
  if (typeof value.__neopot_callback === 'string') {
    const callbackId = value.__neopot_callback;
    return (...args) => rpc('hostCallback', callbackId, ...args);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
}

function commandResponse(result) {
  const headers = new Headers(result.headers || {});
  const data = result.data;
  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    headers,
    data,
    async text() {
      return typeof data === 'string' ? data : JSON.stringify(data);
    },
    async json() {
      return typeof data === 'string' ? JSON.parse(data) : data;
    },
    async arrayBuffer() {
      if (data instanceof ArrayBuffer) return data;
      if (Array.isArray(data)) return new Uint8Array(data).buffer;
      return new TextEncoder().encode(String(data)).buffer;
    },
    clone() {
      return commandResponse(result);
    },
  };
}

const Body = {
  json(data) {
    return { kind: 'json', data };
  },
  text(data) {
    return { kind: 'text', data };
  },
  form(data) {
    return { kind: 'form', data };
  },
};

async function fetch(input, init = {}) {
  return commandResponse(await rpc('httpFetch', String(input), init));
}

const utils = {
  http: { fetch, Body },
  readFile: async (path, options) => new Uint8Array(await rpc('readFile', path, options)),
  readTextFile: (path, options) => rpc('readTextFile', path, options),
  run: (cmdName, args) => rpc('run', { pluginType, pluginName: pluginId.split(':')[1], cmdName, args }),
  openUrl: (url) => rpc('openUrl', url),
  cacheDir: '',
  pluginDir: '',
  pluginOptions: {},
  osType: '',
  log: {
    debug: (...args) => rpc('log', 'debug', args),
    info: (...args) => rpc('log', 'info', args),
    warn: (...args) => rpc('log', 'warn', args),
    error: (...args) => rpc('log', 'error', args),
  },
};

let entrypoint;
let pluginModuleExports = {};

function resolveEntrypoint(exportName) {
  if (typeof exportName === 'string' && exportName.length > 0) {
    return pluginModuleExports[exportName];
  }

  return entrypoint;
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.channel === 'neopot-plugin-rpc-result') {
    const pendingRequest = pending.get(data.requestId);
    if (!pendingRequest) return;
    pending.delete(data.requestId);
    if (data.ok) pendingRequest.resolve(data.value);
    else pendingRequest.reject(new Error(data.error || 'Plugin RPC failed.'));
    return;
  }

  if (data.channel !== 'neopot-plugin-call' || data.pluginId !== pluginId) return;
  try {
    const selectedEntrypoint = resolveEntrypoint(data.exportName);
    if (typeof selectedEntrypoint !== 'function') {
      throw new Error('Plugin entrypoint is not loaded.');
    }
    const args = revive(data.args || []);
    const value = await selectedEntrypoint(...args);
    parent.postMessage({ channel: 'neopot-plugin-result', pluginId, requestId: data.requestId, ok: true, value }, '*');
  } catch (error) {
    parent.postMessage({
      channel: 'neopot-plugin-result',
      pluginId,
      requestId: data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, '*');
  }
});

try {
  const source = decodeBase64(${JSON.stringify(encodedSource)});
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const pluginModule = await import(moduleUrl);
  URL.revokeObjectURL(moduleUrl);
  pluginModuleExports = pluginModule || {};
  entrypoint = pluginModule.default || pluginModule[pluginType] || pluginModule.__neopot_entry || globalThis[pluginType];
  parent.postMessage({ channel: 'neopot-plugin-ready', pluginId, ok: true }, '*');
} catch (error) {
  parent.postMessage({
    channel: 'neopot-plugin-ready',
    pluginId,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, '*');
}
</script>`
}

async function createSandbox(
  pluginType: string,
  pluginName: string,
  script: string,
): Promise<PluginSandbox> {
  attachMessageListener()
  const pluginId = `${pluginType}:${pluginName}`
  const frame = document.createElement('iframe')
  frame.sandbox.add('allow-scripts')
  frame.style.display = 'none'
  frame.setAttribute('aria-hidden', 'true')

  const ready = new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (
        !data ||
        typeof data !== 'object' ||
        data.channel !== 'neopot-plugin-ready' ||
        data.pluginId !== pluginId ||
        event.source !== frame.contentWindow
      ) {
        return
      }

      window.removeEventListener('message', onMessage)
      if (data.ok) {
        resolve()
      } else {
        reject(new Error(data.error || 'Plugin sandbox failed to load.'))
      }
    }

    window.addEventListener('message', onMessage)
  })

  frame.srcdoc = sandboxHtml(pluginId, pluginType, script)
  document.body.appendChild(frame)

  return { pluginId, frame, ready }
}

function prepareCallArgs(value: unknown, localCallbacks: string[]): unknown {
  if (typeof value === 'function') {
    const callbackId = createRequestId()
    callbackMap.set(callbackId, value as HostCallback)
    localCallbacks.push(callbackId)
    return { __neopot_callback: callbackId }
  }

  if (Array.isArray(value)) {
    return value.map((item) => prepareCallArgs(item, localCallbacks))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if ((value as Record<string, unknown>).__neopot_utils === true) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, prepareCallArgs(item, localCallbacks)]),
  )
}

async function callSandbox(
  sandbox: PluginSandbox,
  args: unknown[],
  exportName?: string,
): Promise<unknown> {
  await sandbox.ready
  const requestId = createRequestId()
  const localCallbacks: string[] = []
  const preparedArgs = prepareCallArgs(args, localCallbacks)

  try {
    const promise = new Promise<unknown>((resolve, reject) => {
      pendingCalls.set(requestId, { resolve, reject })
    })

    sandbox.frame.contentWindow?.postMessage(
      {
        channel: 'neopot-plugin-call',
        pluginId: sandbox.pluginId,
        requestId,
        exportName,
        args: preparedArgs,
      },
      '*',
    )

    return await promise
  } finally {
    for (const callbackId of localCallbacks) {
      callbackMap.delete(callbackId)
    }
  }
}

async function getPluginRuntime(pluginType: string, pluginName: string) {
  const pluginId = `${pluginType}:${pluginName}`
  let sandbox = sandboxMap.get(pluginId)

  if (!sandbox) {
    const script = await readTextFile(`plugins/${pluginType}/${pluginName}/main.js`, {
      baseDir: FileBase.Config,
    })
    sandbox = await createSandbox(pluginType, pluginName, script)
    sandboxMap.set(pluginId, sandbox)
  }

  const configDir = await getAppConfigDirectory()
  const cacheDir = await getAppCacheDirectory()
  const pluginDir = joinPath(configDir, 'plugins', pluginType, pluginName)
  const pluginOptions = (await getStoreValue(`plugin_options:${pluginType}:${pluginName}`)) ?? {}
  const utils = {
    __neopot_utils: true,
    cacheDir,
    pluginDir,
    pluginOptions,
    osType,
  }

  return { sandbox, utils }
}

export async function invoke_plugin(pluginType: string, pluginName: string) {
  const { sandbox, utils } = await getPluginRuntime(pluginType, pluginName)
  const activeSandbox = sandbox
  const func = (...args: unknown[]): Promise<unknown> => callSandbox(activeSandbox, args)
  return [func, utils] as const
}

export async function invoke_plugin_handler(
  pluginType: string,
  pluginName: string,
  handler: string,
  payload: Record<string, unknown> = {},
): Promise<unknown> {
  const { sandbox, utils } = await getPluginRuntime(pluginType, pluginName)
  return callSandbox(
    sandbox,
    [
      {
        ...payload,
        utils,
      },
    ],
    handler,
  )
}
