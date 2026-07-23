const HTML_RELEASE_NOTE_PATTERN =
  /<\/?(?:article|blockquote|br|code|div|em|h[1-6]|hr|li|ol|p|pre|section|span|strong|table|tbody|td|th|thead|tr|ul)\b/iu

export function looksLikeHtmlReleaseNotes(value: string): boolean {
  return HTML_RELEASE_NOTE_PATTERN.test(value)
}
