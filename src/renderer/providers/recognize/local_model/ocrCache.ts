export function getOrCreateCachedOcr<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  create: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const pending = create().catch((error) => {
    if (cache.get(key) === pending) {
      cache.delete(key)
    }
    throw error
  })
  cache.set(key, pending)
  return pending
}
