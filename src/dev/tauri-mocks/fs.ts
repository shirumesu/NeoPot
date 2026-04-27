export enum BaseDirectory {
    AppConfig = 'AppConfig',
    AppCache = 'AppCache',
    AppLog = 'AppLog',
}

export async function readDir() {
    return [];
}

export async function readTextFile() {
    return '';
}

export async function readFile() {
    return new Uint8Array();
}

export async function exists() {
    return false;
}

export async function remove() {}

export async function watch() {
    return () => {};
}
