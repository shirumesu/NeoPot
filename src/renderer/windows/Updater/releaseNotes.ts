export interface ReleaseNoteTextNode {
  kind: 'text'
  value: string
}

export interface ReleaseNoteElementNode {
  kind: 'element'
  tagName: string
  attributes?: Record<string, string>
  children: ReleaseNoteNode[]
}

export type ReleaseNoteNode = ReleaseNoteTextNode | ReleaseNoteElementNode
export type ReleaseNotesHtmlParser = (html: string) => ReleaseNoteNode[] | null

const HTML_RELEASE_NOTE_PATTERN =
  /<\/?(?:article|blockquote|br|code|div|em|h[1-6]|hr|li|ol|p|pre|section|span|strong|table|tbody|td|th|thead|tr|ul)\b/i

export function looksLikeHtmlReleaseNotes(value: string): boolean {
  return HTML_RELEASE_NOTE_PATTERN.test(value)
}

export function normalizeReleaseNotes(
  value: string,
  parseHtml: ReleaseNotesHtmlParser = parseHtmlWithDomParser,
): string {
  if (!looksLikeHtmlReleaseNotes(value)) {
    return value
  }

  const nodes = parseHtml(value)
  if (!nodes || nodes.length === 0) {
    return stripHtmlToText(value)
  }

  const markdown = normalizeMarkdownWhitespace(renderNodes(nodes, 'block'))
  return markdown || stripHtmlToText(value)
}

function parseHtmlWithDomParser(html: string): ReleaseNoteNode[] | null {
  if (typeof DOMParser === 'undefined') {
    return null
  }

  const document = new DOMParser().parseFromString(html, 'text/html')
  return domNodesToReleaseNoteNodes(document.body.childNodes)
}

function domNodesToReleaseNoteNodes(nodes: NodeListOf<ChildNode>): ReleaseNoteNode[] {
  return Array.from(nodes)
    .map(domNodeToReleaseNoteNode)
    .filter((node): node is ReleaseNoteNode => Boolean(node))
}

function domNodeToReleaseNoteNode(node: ChildNode): ReleaseNoteNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { kind: 'text', value: node.textContent ?? '' }
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'script' || tagName === 'style') {
    return null
  }

  const attributes: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name.toLowerCase()] = attribute.value
  }

  return {
    kind: 'element',
    tagName,
    attributes,
    children: domNodesToReleaseNoteNodes(element.childNodes),
  }
}

function renderNodes(nodes: ReleaseNoteNode[], context: 'block' | 'inline' | 'pre'): string {
  return nodes.map((node) => renderNode(node, context)).join('')
}

function renderNode(node: ReleaseNoteNode, context: 'block' | 'inline' | 'pre'): string {
  if (node.kind === 'text') {
    return context === 'pre' ? node.value : escapeMarkdownText(node.value.replace(/\s+/g, ' '))
  }

  const tagName = node.tagName.toLowerCase()

  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName[1])
    return `${'#'.repeat(level)} ${renderInline(node.children)}\n\n`
  }

  switch (tagName) {
    case 'article':
    case 'div':
    case 'p':
    case 'section':
      return renderBlock(node.children)
    case 'strong':
    case 'b':
      return wrapInline('**', node.children)
    case 'em':
    case 'i':
      return wrapInline('*', node.children)
    case 'code':
      return formatInlineCode(readPlainText(node.children))
    case 'pre':
      return `\`\`\`\n${readPlainText(node.children).trimEnd()}\n\`\`\`\n\n`
    case 'ul':
      return renderList(node.children, false)
    case 'ol':
      return renderList(node.children, true)
    case 'li':
      return renderListItem(node.children)
    case 'blockquote':
      return renderBlockquote(node.children)
    case 'br':
      return '  \n'
    case 'hr':
      return '---\n\n'
    case 'a':
      return renderLink(node)
    case 'table':
      return `${readPlainText(node.children).replace(/\s+/g, ' ').trim()}\n\n`
    case 'tbody':
    case 'td':
    case 'th':
    case 'thead':
    case 'tr':
    case 'span':
      return renderNodes(node.children, context)
    default:
      return renderNodes(node.children, context)
  }
}

function renderBlock(children: ReleaseNoteNode[]): string {
  const content = renderInline(children)
  return content ? `${content}\n\n` : ''
}

function renderInline(children: ReleaseNoteNode[]): string {
  return renderNodes(children, 'inline')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim()
}

function wrapInline(marker: string, children: ReleaseNoteNode[]): string {
  const content = renderInline(children)
  return content ? `${marker}${content}${marker}` : ''
}

function renderList(children: ReleaseNoteNode[], ordered: boolean): string {
  const items = children.filter(
    (child): child is ReleaseNoteElementNode => child.kind === 'element' && child.tagName === 'li',
  )

  const markdown = items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}. ` : '- '
      const content = renderListItem(item.children)
      const indented = content
        .split('\n')
        .map((line, lineIndex) => (lineIndex === 0 ? line : `${' '.repeat(marker.length)}${line}`))
        .join('\n')

      return `${marker}${indented}`
    })
    .join('\n')

  return markdown ? `${markdown}\n\n` : ''
}

function renderListItem(children: ReleaseNoteNode[]): string {
  return children
    .map((child) => {
      if (child.kind === 'element' && (child.tagName === 'ul' || child.tagName === 'ol')) {
        return `\n${renderNode(child, 'block').trim()}`
      }

      return renderNode(child, 'inline')
    })
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function renderBlockquote(children: ReleaseNoteNode[]): string {
  const content = normalizeMarkdownWhitespace(renderNodes(children, 'block'))
  if (!content) {
    return ''
  }

  return `${content
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')}\n\n`
}

function renderLink(node: ReleaseNoteElementNode): string {
  const text = renderInline(node.children) || node.attributes?.href || ''
  const href = node.attributes?.href?.trim()
  if (!href || !isSafeMarkdownUrl(href)) {
    return text
  }

  return `[${text.replace(/[[\]]/g, '\\$&')}](${href.replace(/[()]/g, encodeURIComponent)})`
}

function readPlainText(nodes: ReleaseNoteNode[]): string {
  return nodes
    .map((node) => (node.kind === 'text' ? node.value : readPlainText(node.children)))
    .join('')
}

function formatInlineCode(value: string): string {
  const code = value.trim()
  if (!code) {
    return ''
  }

  const longestBacktickRun = Math.max(
    0,
    ...[...code.matchAll(/`+/g)].map((match) => match[0].length),
  )
  const fence = '`'.repeat(longestBacktickRun + 1)
  return `${fence}${code}${fence}`
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\*_<>[\]])/g, '\\$1')
}

function normalizeMarkdownWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripHtmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

function isSafeMarkdownUrl(value: string): boolean {
  try {
    const url = new URL(value, 'https://github.com')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}
