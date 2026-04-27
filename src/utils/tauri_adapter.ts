import { invoke } from '@tauri-apps/api/core';

export interface TauriCommandMap {
    get_text: {
        args: undefined;
        result: string;
    };
    get_base64: {
        args: undefined;
        result: string;
    };
    open_devtools: {
        args: undefined;
        result: void;
    };
    reload_store: {
        args: undefined;
        result: void;
    };
}

export interface RunBinaryArgs {
    pluginType: string;
    pluginName: string;
    cmdName: string;
    args?: unknown;
}

export interface InvokeOptions<TPayload> {
    command: string;
    payload?: TPayload;
}

export async function tauriInvoke<TResponse = unknown, TPayload = Record<string, unknown>>(
    options: InvokeOptions<TPayload>
): Promise<TResponse> {
    const payload = options.payload ?? {};
    return invoke<TResponse>(options.command, payload as Record<string, unknown>);
}

export async function tauriCommand<TCommand extends keyof TauriCommandMap>(
    command: TCommand,
    args?: TauriCommandMap[TCommand]['args']
): Promise<TauriCommandMap[TCommand]['result']> {
    return invoke<TauriCommandMap[TCommand]['result']>(command, (args ?? {}) as Record<string, unknown>);
}

export async function runPluginBinary<TResponse = unknown>(args: RunBinaryArgs): Promise<TResponse> {
    return tauriInvoke<TResponse, RunBinaryArgs>({
        command: 'run_binary',
        payload: args,
    });
}
