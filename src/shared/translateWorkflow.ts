export type SelectionCaptureMethod =
  | 'linux-primary-selection'
  | 'linux-clipboard-fallback'
  | 'windows-clipboard-fallback'
  | 'macos-clipboard-fallback'
  | 'unsupported-clipboard-fallback'

export type SelectionCaptureFailureReason =
  | 'empty'
  | 'copy-helper-unavailable'
  | 'copy-command-failed'
  | 'copy-timeout'
  | 'unsupported-platform'

export type SelectionCaptureResult =
  | {
      ok: true
      text: string
      method: SelectionCaptureMethod
    }
  | {
      ok: false
      reason: SelectionCaptureFailureReason
      method: SelectionCaptureMethod
    }

export type TranslateWorkflowPayload =
  | {
      kind: 'text'
      text: string
    }
  | {
      kind: 'selection'
      capture: SelectionCaptureResult
    }
  | {
      kind: 'input'
    }
  | {
      kind: 'image'
    }

const selectionCaptureMethods = new Set<SelectionCaptureMethod>([
  'linux-primary-selection',
  'linux-clipboard-fallback',
  'windows-clipboard-fallback',
  'macos-clipboard-fallback',
  'unsupported-clipboard-fallback',
])

const selectionCaptureFailureReasons = new Set<SelectionCaptureFailureReason>([
  'empty',
  'copy-helper-unavailable',
  'copy-command-failed',
  'copy-timeout',
  'unsupported-platform',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSelectionCaptureMethod(value: unknown): value is SelectionCaptureMethod {
  return typeof value === 'string' && selectionCaptureMethods.has(value as SelectionCaptureMethod)
}

function isSelectionCaptureFailureReason(value: unknown): value is SelectionCaptureFailureReason {
  return (
    typeof value === 'string' &&
    selectionCaptureFailureReasons.has(value as SelectionCaptureFailureReason)
  )
}

function toSelectionCaptureResult(value: unknown): SelectionCaptureResult | null {
  if (!isRecord(value) || !isSelectionCaptureMethod(value.method)) {
    return null
  }

  if (value.ok === true && typeof value.text === 'string') {
    return {
      ok: true,
      text: value.text,
      method: value.method,
    }
  }

  if (value.ok === false && isSelectionCaptureFailureReason(value.reason)) {
    return {
      ok: false,
      reason: value.reason,
      method: value.method,
    }
  }

  return null
}

export function toTranslateWorkflowPayload(value: unknown): TranslateWorkflowPayload {
  if (typeof value === 'string') {
    if (value === '[INPUT_TRANSLATE]') {
      return { kind: 'input' }
    }
    if (value === '[IMAGE_TRANSLATE]') {
      return { kind: 'image' }
    }
    return { kind: 'text', text: value }
  }

  if (!isRecord(value)) {
    return { kind: 'text', text: '' }
  }

  switch (value.kind) {
    case 'text':
      return {
        kind: 'text',
        text: typeof value.text === 'string' ? value.text : '',
      }
    case 'selection': {
      const capture = toSelectionCaptureResult(value.capture)
      if (capture) {
        return {
          kind: 'selection',
          capture,
        }
      }
      return { kind: 'text', text: '' }
    }
    case 'input':
      return { kind: 'input' }
    case 'image':
      return { kind: 'image' }
    default:
      return { kind: 'text', text: '' }
  }
}
