function createUnavailableFunction(api: string) {
  return () => {
    throw new Error(`${api} is not available in the renderer process.`)
  }
}

export const readFileSync = createUnavailableFunction('fs.readFileSync')
export const normalize = createUnavailableFunction('path.normalize')
export const randomBytes = createUnavailableFunction('crypto.randomBytes')
export const randomFillSync = createUnavailableFunction('crypto.randomFillSync')
export const getRandomValues = createUnavailableFunction('crypto.getRandomValues')

const exportsByName = {
  readFileSync,
  normalize,
  randomBytes,
  randomFillSync,
  getRandomValues,
}

export default new Proxy(exportsByName, {
  get(target, property: keyof typeof exportsByName | string | symbol) {
    if (property in target) {
      return target[property as keyof typeof exportsByName]
    }
    return createUnavailableFunction(`node:${String(property)}`)
  },
})
