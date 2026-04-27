const root = '/browser-smoke';

export async function appConfigDir() {
    return `${root}/config`;
}

export async function appCacheDir() {
    return `${root}/cache`;
}

export async function appLogDir() {
    return `${root}/logs`;
}

export async function join(...parts: string[]) {
    return parts.join('/').replace(/\/+/g, '/');
}
