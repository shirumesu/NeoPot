export async function debug(...args: unknown[]) {
    console.debug('[browser-smoke]', ...args);
}

export async function info(...args: unknown[]) {
    console.info('[browser-smoke]', ...args);
}

export async function warn(...args: unknown[]) {
    console.warn('[browser-smoke]', ...args);
}

export async function error(...args: unknown[]) {
    console.error('[browser-smoke]', ...args);
}
