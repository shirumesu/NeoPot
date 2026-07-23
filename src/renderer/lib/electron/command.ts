export interface ElectronCommandMap {
  get_text: {
    args: undefined
    result: string
  }
  get_base64: {
    args: undefined
    result: string
  }
  translate_text: {
    args: {
      text: string
    }
    result: void
  }
  open_devtools: {
    args: undefined
    result: void
  }
  set_proxy: {
    args: undefined
    result: boolean
  }
  unset_proxy: {
    args: undefined
    result: boolean
  }
  set_clipboard_monitor: {
    args: {
      enabled: boolean
    }
    result: boolean
  }
  run_binary: {
    args: RunBinaryArgs
    result: {
      stdout: string
      stderr: string
    }
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
    result: string
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
  copy_img: {
    args: {
      width: number
      height: number
    }
    result: void
  }
  lang_detect: {
    args: {
      text: string
    }
    result: string
  }
  font_list: {
    args: undefined
    result: string[]
  }
  update_tray: {
    args: {
      language: string
      copyMode: string
    }
    result: void
  }
  updater_window: {
    args: undefined
    result: void
  }
  open_url: {
    args: {
      url: string
    }
    result: void
  }
  open_log_dir: {
    args: undefined
    result: void
  }
  open_config_dir: {
    args: undefined
    result: void
  }
  'log:set-level': {
    args: {
      level: string
    }
    result: boolean
  }
  'log:get-level': {
    args: undefined
    result: string | false
  }
}

export interface RunBinaryArgs {
  pluginType: string
  pluginName: string
  cmdName: string
  args?: unknown
}

export async function invokeCommand<TCommand extends keyof ElectronCommandMap>(
  command: TCommand,
  ...args: ElectronCommandMap[TCommand]['args'] extends undefined
    ? []
    : [ElectronCommandMap[TCommand]['args']]
): Promise<ElectronCommandMap[TCommand]['result']> {
  return window.neoPot.command.invoke<ElectronCommandMap[TCommand]['result']>(
    command,
    args[0] as Record<string, unknown> | undefined,
  )
}
