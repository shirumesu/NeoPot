interface ParsedVersion {
  parts: [number, number, number]
  prerelease: string[]
}

export function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function parseVersion(version: string): ParsedVersion | null {
  const normalized = stripVersionPrefix(version)
  const withoutBuild = normalized.split('+', 1)[0]
  const match = withoutBuild.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) {
    return null
  }

  return {
    parts: [
      Number(match[1]),
      match[2] === undefined ? 0 : Number(match[2]),
      match[3] === undefined ? 0 : Number(match[3]),
    ],
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

export function isSemanticVersion(version: string): boolean {
  return parseVersion(version) !== null
}

function comparePrereleaseIdentifier(a: string, b: string): number {
  if (a === b) {
    return 0
  }

  const aIsNumber = /^\d+$/.test(a)
  const bIsNumber = /^\d+$/.test(b)
  if (aIsNumber && bIsNumber) {
    return Number(a) - Number(b)
  }
  if (aIsNumber) {
    return -1
  }
  if (bIsNumber) {
    return 1
  }
  return a < b ? -1 : 1
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 0
  }
  if (a.length === 0) {
    return 1
  }
  if (b.length === 0) {
    return -1
  }

  const maxLength = Math.max(a.length, b.length)
  for (let index = 0; index < maxLength; index += 1) {
    const aIdentifier = a[index]
    const bIdentifier = b[index]
    if (aIdentifier === undefined) {
      return -1
    }
    if (bIdentifier === undefined) {
      return 1
    }

    const diff = comparePrereleaseIdentifier(aIdentifier, bIdentifier)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)
  if (!parsedA || !parsedB) {
    return stripVersionPrefix(a).localeCompare(stripVersionPrefix(b))
  }

  for (let index = 0; index < 3; index += 1) {
    const diff = parsedA.parts[index] - parsedB.parts[index]
    if (diff !== 0) {
      return diff
    }
  }

  return comparePrerelease(parsedA.prerelease, parsedB.prerelease)
}

export function isPrereleaseVersion(version: string): boolean {
  return parseVersion(version)?.prerelease.length !== 0
}
