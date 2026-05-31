export const debounce = <TArgs extends unknown[]>(fn: (...args: TArgs) => void, delay = 500) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: TArgs) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => fn(...args), delay)
  }
}
