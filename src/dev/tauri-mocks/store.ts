const stores = new Map<string, Map<string, unknown>>();

export class LazyStore {
    private values: Map<string, unknown>;

    constructor(path: string) {
        if (!stores.has(path)) {
            stores.set(path, new Map());
        }
        this.values = stores.get(path)!;
    }

    async init() {}

    async reload() {}

    async save() {}

    async get<T>(key: string): Promise<T | undefined> {
        return this.values.get(key) as T | undefined;
    }

    async set(key: string, value: unknown) {
        this.values.set(key, value);
    }

    async has(key: string) {
        return this.values.has(key);
    }

    async delete(key: string) {
        return this.values.delete(key);
    }
}
