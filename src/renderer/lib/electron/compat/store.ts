export class LazyStore {
  constructor(_path: string) {
    // Browser compatibility mode stores data through preload-backed APIs.
  }
  async init() {
    // Store initialization is a no-op in browser compatibility mode.
  }
  async get(_key: string) {
    return undefined
  }
  async set(_key: string, _value: unknown) {
    // Browser compatibility mode has no writable LazyStore backing file.
  }
  async has(_key: string) {
    return false
  }
  async delete(_key: string) {
    // Browser compatibility mode has no writable LazyStore backing file.
  }
  async save() {
    // Browser compatibility mode has no writable LazyStore backing file.
  }
  async reload(_options?: unknown) {
    // Browser compatibility mode has no writable LazyStore backing file.
  }
}
