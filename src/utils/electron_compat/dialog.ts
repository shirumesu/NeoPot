export async function open(options?: Record<string, unknown>) {
  return (await window.neoPot?.dialog?.open(options)) ?? null
}

export async function save() {
  return null
}
