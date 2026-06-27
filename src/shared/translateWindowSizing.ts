export interface TranslateWindowSize {
  width: number
  height: number
}

export interface TranslateWindowSizingInput {
  text: string
  workArea: TranslateWindowSize
  fontSize?: number
}

const MIN_TRANSLATE_WINDOW_SIZE: TranslateWindowSize = {
  width: 350,
  height: 420,
}

const MAX_TRANSLATE_WINDOW_SIZE: TranslateWindowSize = {
  width: 640,
  height: 800,
}

const DISPLAY_MARGIN = 80

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function codePointLength(value: string): number {
  return Array.from(value).length
}

function normalizedFontSize(value: number | undefined): number {
  const fontSize = value ?? 16
  return Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 28 ? fontSize : 16
}

function estimateWrappedLineCount(lines: string[], charsPerLine: number): number {
  return lines.reduce((total, line) => {
    const length = Math.max(1, codePointLength(line.trimEnd()))
    return total + Math.max(1, Math.ceil(length / charsPerLine))
  }, 0)
}

export function calculateAdaptiveTranslateWindowSize(
  input: TranslateWindowSizingInput,
): TranslateWindowSize {
  const text = input.text.trim()
  const fontSize = normalizedFontSize(input.fontSize)
  const charWidth = fontSize * 0.56
  const lineHeight = fontSize * 1.45
  const maxWidth = clamp(
    input.workArea.width - DISPLAY_MARGIN,
    MIN_TRANSLATE_WINDOW_SIZE.width,
    MAX_TRANSLATE_WINDOW_SIZE.width,
  )
  const maxHeight = clamp(
    input.workArea.height - DISPLAY_MARGIN,
    MIN_TRANSLATE_WINDOW_SIZE.height,
    MAX_TRANSLATE_WINDOW_SIZE.height,
  )

  if (text.length === 0) {
    return {
      width: Math.min(MIN_TRANSLATE_WINDOW_SIZE.width, maxWidth),
      height: Math.min(MIN_TRANSLATE_WINDOW_SIZE.height, maxHeight),
    }
  }

  const lines = text.split(/\r?\n/)
  const textLength = codePointLength(text)
  const longestLineLength = Math.max(...lines.map(codePointLength))
  const baseWidth = textLength < 80 ? 380 : textLength < 240 ? 480 : textLength < 700 ? 580 : 640
  const longLineWidth = 280 + Math.min(longestLineLength, 42) * charWidth
  const width = Math.round(clamp(Math.max(baseWidth, longLineWidth), 350, maxWidth))
  const charsPerLine = Math.max(24, Math.floor((width - 72) / charWidth))
  const estimatedLines = estimateWrappedLineCount(lines, charsPerLine)
  const height = Math.round(clamp(360 + estimatedLines * lineHeight, 420, maxHeight))

  return {
    width,
    height,
  }
}
