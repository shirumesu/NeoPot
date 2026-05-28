export interface ElectronCommandMap {
  get_text: {
    args: undefined
    result: string
  }
  get_base64: {
    args: undefined
    result: string
  }
  open_devtools: {
    args: undefined
    result: void
  }
  reload_store: {
    args: undefined
    result: void
  }
  register_shortcut_by_frontend: {
    args: {
      name: string
      shortcut: string
    }
    result: boolean
  }
  screenshot: {
    args: {
      x: number
      y: number
    }
    result: void
  }
  cut_image: {
    args: {
      left: number
      top: number
      width: number
      height: number
    }
    result: string
  }
  screenshot_complete: {
    args: {
      action: 'recognize' | 'translate'
    }
    result: void
  }
}

export interface RunBinaryArgs {
  pluginType: string
  pluginName: string
  cmdName: string
  args?: unknown
}

export interface InvokeOptions<TPayload> {
  command: string
  payload?: TPayload
}

export async function electronInvoke<TResponse = unknown, TPayload = Record<string, unknown>>(
  options: InvokeOptions<TPayload>,
): Promise<TResponse> {
  return electronCommand(
    options.command as keyof ElectronCommandMap,
    options.payload as never,
  ) as Promise<TResponse>
}

export async function electronCommand<TCommand extends keyof ElectronCommandMap>(
  command: TCommand,
  args?: ElectronCommandMap[TCommand]['args'] | Record<string, unknown>,
): Promise<ElectronCommandMap[TCommand]['result']> {
  if (window.neoPot?.command) {
    return window.neoPot.command.invoke<ElectronCommandMap[TCommand]['result']>(
      String(command),
      args as Record<string, unknown> | undefined,
    )
  }

  switch (command) {
    case 'get_text':
      return '' as ElectronCommandMap[TCommand]['result']
    case 'get_base64':
      return '' as ElectronCommandMap[TCommand]['result']
    case 'open_devtools':
      return undefined as ElectronCommandMap[TCommand]['result']
    case 'reload_store':
      return undefined as ElectronCommandMap[TCommand]['result']
    default:
      throw new Error(`Unsupported Electron command: ${String(command)}`)
  }
}

export async function runPluginBinary<TResponse = unknown>(
  args: RunBinaryArgs,
): Promise<TResponse> {
  return electronInvoke<TResponse, RunBinaryArgs>({
    command: 'run_binary',
    payload: args,
  })
}
