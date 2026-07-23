// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SafeRichText } from '../../src/renderer/components/SafeRichText'

afterEach(cleanup)

describe('SafeRichText', () => {
  it('renders allowlisted release-note structure directly', () => {
    render(
      <SafeRichText value="<h2>Highlights</h2><p>Use <strong>NeoPot</strong>.</p><ul><li>Portable</li></ul>" />,
    )

    expect(screen.getByRole('heading', { name: 'Highlights' }).tagName).toBe('H2')
    expect(screen.getByText('NeoPot').tagName).toBe('STRONG')
    expect(screen.getByRole('listitem').textContent).toBe('Portable')
  })

  it('drops active content and unwraps unsafe links', () => {
    render(
      <SafeRichText
        value={'<p>Open <a href="javascript:alert(1)">this</a></p><script>bad()</script>'}
      />,
    )

    expect(screen.getByText('Open this').textContent).toBe('Open this')
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText('bad()')).toBeNull()
  })
})
