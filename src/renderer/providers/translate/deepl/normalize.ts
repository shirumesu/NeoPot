export function normalizeRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is not configured.`)
  }

  return value.trim()
}
