import { electronInvoke } from "../electron_command";

export function convertFileSrc(path: string) {
  return path;
}

export async function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
        return await electronInvoke<T>({ command, payload: args });
    } catch {
        return null as T;
    }
}
