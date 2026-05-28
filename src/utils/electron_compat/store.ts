export class LazyStore {
    constructor(_path: string) {}
    async init() {}
    async get(_key: string) {
        return undefined;
    }
    async set(_key: string, _value: unknown) {}
    async has(_key: string) {
        return false;
    }
    async delete(_key: string) {}
    async save() {}
    async reload(_options?: unknown) {}
}
