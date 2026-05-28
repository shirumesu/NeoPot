export async function writeText(text: string) {
  await navigator.clipboard?.writeText(text)
}
