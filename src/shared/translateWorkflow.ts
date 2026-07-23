export type SelectionCaptureMethod =
  | 'linux-primary-selection'
  | 'linux-clipboard-fallback'
  | 'windows-uia-selection'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toTranslateWorkflowPayload(value: unknown): TranslateWorkflowPayload {
  if (!isRecord(value)) {
    return { kind: 'text', text: '' }
  }

  switch (value.kind) {
    case 'text':
    case 'selection':
    case 'input':
    case 'image':
      return value as TranslateWorkflowPayload
    default:
      return { kind: 'text', text: '' }
  }
}
