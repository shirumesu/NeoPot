import React from 'react'

const droppedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
])

function safeHref(value: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value, 'https://github.com')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : undefined
  } catch {
    return undefined
  }
}

function renderNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as Element
  const tag = element.tagName.toLowerCase()
  if (droppedTags.has(tag)) {
    return null
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderNode(child, `${key}-${index}`),
  )

  switch (tag) {
    case 'article':
      return <article key={key}>{children}</article>
    case 'section':
      return <section key={key}>{children}</section>
    case 'div':
      return <div key={key}>{children}</div>
    case 'span':
      return <span key={key}>{children}</span>
    case 'p':
      return <p key={key}>{children}</p>
    case 'h1':
      return <h1 key={key}>{children}</h1>
    case 'h2':
      return <h2 key={key}>{children}</h2>
    case 'h3':
      return <h3 key={key}>{children}</h3>
    case 'h4':
      return <h4 key={key}>{children}</h4>
    case 'h5':
      return <h5 key={key}>{children}</h5>
    case 'h6':
      return <h6 key={key}>{children}</h6>
    case 'b':
    case 'strong':
      return <strong key={key}>{children}</strong>
    case 'i':
    case 'em':
      return <em key={key}>{children}</em>
    case 'u':
      return <u key={key}>{children}</u>
    case 'code':
      return <code key={key}>{children}</code>
    case 'pre':
      return <pre key={key}>{children}</pre>
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    case 'ul':
      return <ul key={key}>{children}</ul>
    case 'ol':
      return <ol key={key}>{children}</ol>
    case 'li':
      return <li key={key}>{children}</li>
    case 'table':
      return <table key={key}>{children}</table>
    case 'thead':
      return <thead key={key}>{children}</thead>
    case 'tbody':
      return <tbody key={key}>{children}</tbody>
    case 'tr':
      return <tr key={key}>{children}</tr>
    case 'th':
      return <th key={key}>{children}</th>
    case 'td':
      return <td key={key}>{children}</td>
    case 'a': {
      const href = safeHref(element.getAttribute('href'))
      return href ? (
        <a key={key} href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      ) : (
        <React.Fragment key={key}>{children}</React.Fragment>
      )
    }
    case 'br':
      return <br key={key} />
    case 'hr':
      return <hr key={key} />
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>
  }
}

export function renderSafeRichText(value: string): React.ReactNode[] {
  if (typeof DOMParser === 'undefined') {
    return [value]
  }

  const document = new DOMParser().parseFromString(value, 'text/html')
  return Array.from(document.body.childNodes).map((node, index) => renderNode(node, String(index)))
}

export function SafeRichText({ value }: { value: string }) {
  return <>{renderSafeRichText(value)}</>
}
