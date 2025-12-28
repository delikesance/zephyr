/**
 * Smart Template Scoping
 * 
 * Only scopes elements that have classes or IDs
 * Uses efficient single-pass algorithm
 */

/**
 * Injects scope ID into elements that have classes or IDs
 * 
 * @param template - The template HTML
 * @param scopeId - The scope ID to inject
 * @returns Template with scope IDs injected
 */
export function smartScopeTemplate(template: string, scopeId: string): string {
  if (!template.trim()) {
    return template
  }

  const scopeAttr = ` data-${scopeId}`
  const parts: string[] = []
  let i = 0
  const len = template.length

  while (i < len) {
    // Find next opening tag
    const tagStart = template.indexOf('<', i)

    if (tagStart === -1) {
      // No more tags, add remaining text
      parts.push(template.slice(i))
      break
    }

    // Add text before tag
    if (tagStart > i) {
      parts.push(template.slice(i, tagStart))
    }

    // Find tag end
    const tagEnd = template.indexOf('>', tagStart)
    if (tagEnd === -1) {
      // Malformed, add rest and break
      parts.push(template.slice(tagStart))
      break
    }

    const tagContent = template.slice(tagStart, tagEnd + 1)

    // Check if it's a comment or special tag
    if (tagContent.startsWith('<!--') ||
      tagContent.startsWith('<!') ||
      tagContent.startsWith('<?')) {
      parts.push(tagContent)
      i = tagEnd + 1
      continue
    }

    // Check if it's a closing tag
    if (tagContent.startsWith('</')) {
      parts.push(tagContent)
      i = tagEnd + 1
      continue
    }

    // Check if it's a self-closing tag
    const isSelfClosing = tagContent.endsWith('/>') ||
      tagContent.match(/^<(\w+)[^>]*\/\s*>$/i)

    // Check if element has class, id, or data-reactive attribute
    const hasClass = /class\s*=\s*["']/.test(tagContent) ||
      /class\s*=\s*[^\s>]/.test(tagContent)
    const hasId = /id\s*=\s*["']/.test(tagContent) ||
      /id\s*=\s*[^\s>]/.test(tagContent)
    const hasReactive = /data-reactive\s*=/.test(tagContent)

    if (hasClass || hasId || hasReactive) {
      // Inject scope ID before closing >
      if (isSelfClosing) {
        // Self-closing: <tag ... />
        const beforeClose = tagContent.slice(0, -2).trim()
        parts.push(`${beforeClose}${scopeAttr} />`)
      } else {
        // Regular tag: <tag ...>
        const beforeClose = tagContent.slice(0, -1)
        parts.push(`${beforeClose}${scopeAttr}>`)
      }
    } else {
      // No class/ID, don't scope
      parts.push(tagContent)
    }

    i = tagEnd + 1
  }

  return parts.join('')
}
