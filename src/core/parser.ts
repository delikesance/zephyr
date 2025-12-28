/**
 * Parser for .zph files
 * 
 * Extracts script, template, style sections, and imports from .zph file content
 */

import type { ZephyrComponent } from '../types/component.js'
import { extractComponentName } from '../utils/path.js'
import { generateScopeId } from '../utils/scope-id.js'

/**
 * Parses a .zph file and extracts script, template, style sections, and imports
 * 
 * @param content - The content of the .zph file
 * @param filename - The filename (used to extract component name)
 * @returns Parsed ZephyrComponent
 * @throws Error if the file is malformed or empty
 */
export function parseZephyrFile(content: string, filename: string): ZephyrComponent {
  if (typeof content !== 'string') {
    throw new Error(`Invalid content for file: ${filename}`)
  }

  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename is required')
  }

  const name = extractComponentName(filename)
  const scopeId = generateScopeId(name)

  // Extract sections - handle case-insensitive matching and attributes
  const script = extractSection(content, 'script')
  const template = extractSection(content, 'template')
  const styleResult = extractStyleSection(content)

  // Extract store section (for store components)
  const store = extractSection(content, 'store')

  // Detect if this is a store component (has <store> instead of <template>)
  const isStore = store !== '' && template === ''

  // Extract imports (not in script block)
  const imports = extractImports(content)

  // Warn if template is missing (but not if it's a store component)
  if (!template && !isStore) {
    console.warn(`Warning: No <template> section found in ${filename}`)
  }

  return {
    name,
    script,
    template,
    style: styleResult.content,
    styleScoped: styleResult.scoped,
    imports,
    scopeId,
    store,
    isStore,
  }
}

/**
 * Extracts a section (script or template) from .zph file content
 * Handles nested tags, attributes, and whitespace properly
 */
function extractSection(content: string, tagName: string): string {
  // Case-insensitive regex to find opening tag with optional attributes
  const openTagRegex = new RegExp(`<${tagName}([^>]*)>`, 'i')
  const closeTagRegex = new RegExp(`</${tagName}>`, 'i')

  const openMatch = content.match(openTagRegex)
  if (!openMatch) {
    return ''
  }

  // Find the position after the opening tag
  const openTagEnd = openMatch.index! + openMatch[0].length
  const remainingContent = content.slice(openTagEnd)

  // Find the matching closing tag
  // We need to handle nested tags of the same type (e.g., <script> inside <script>)
  let depth = 1
  let position = 0
  let found = false

  while (position < remainingContent.length && depth > 0) {
    // Look for opening tags
    const nextOpen = remainingContent.indexOf(`<${tagName}`, position)
    const nextOpenEnd = remainingContent.indexOf('>', nextOpen)

    // Look for closing tags
    const nextClose = remainingContent.indexOf(`</${tagName}>`, position)

    // Check if we found a closing tag before any opening tag
    if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
      depth--
      if (depth === 0) {
        // Found the matching closing tag
        const sectionContent = remainingContent.slice(0, nextClose)
        return sectionContent.trim()
      }
      position = nextClose + `</${tagName}>`.length
    } else if (nextOpen !== -1 && nextOpenEnd !== -1) {
      // Found an opening tag - check if it's self-closing
      const tagContent = remainingContent.slice(nextOpen, nextOpenEnd + 1)
      if (!tagContent.endsWith('/>')) {
        depth++
      }
      position = nextOpenEnd + 1
    } else {
      // No more tags found, but we haven't closed - malformed
      break
    }
  }

  // If we didn't find a proper closing tag, try simple approach
  // This handles the common case where there are no nested tags
  const simpleCloseMatch = remainingContent.match(closeTagRegex)
  if (simpleCloseMatch) {
    return remainingContent.slice(0, simpleCloseMatch.index).trim()
  }

  // No closing tag found
  return ''
}

/**
 * Extracts style section and detects if it's scoped
 * Returns both content and scoped status
 */
function extractStyleSection(content: string): { content: string; scoped: boolean } {
  // Case-insensitive regex to find opening tag with optional attributes
  const openTagRegex = new RegExp(`<style([^>]*)>`, 'i')
  const closeTagRegex = new RegExp(`</style>`, 'i')

  const openMatch = content.match(openTagRegex)
  if (!openMatch) {
    return { content: '', scoped: true } // Default to scoped if no style tag
  }

  // Check if scoped attribute is present
  const attributes = openMatch[1] || ''
  const isScoped = /\bscoped\b/i.test(attributes)

  // Find the position after the opening tag
  const openTagEnd = openMatch.index! + openMatch[0].length
  const remainingContent = content.slice(openTagEnd)

  // Find the matching closing tag
  let depth = 1
  let position = 0

  while (position < remainingContent.length && depth > 0) {
    // Look for opening tags
    const nextOpen = remainingContent.indexOf(`<style`, position)
    const nextOpenEnd = remainingContent.indexOf('>', nextOpen)

    // Look for closing tags
    const nextClose = remainingContent.indexOf(`</style>`, position)

    // Check if we found a closing tag before any opening tag
    if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
      depth--
      if (depth === 0) {
        // Found the matching closing tag
        const sectionContent = remainingContent.slice(0, nextClose)
        return { content: sectionContent.trim(), scoped: isScoped }
      }
      position = nextClose + `</style>`.length
    } else if (nextOpen !== -1 && nextOpenEnd !== -1) {
      // Found an opening tag - check if it's self-closing
      const tagContent = remainingContent.slice(nextOpen, nextOpenEnd + 1)
      if (!tagContent.endsWith('/>')) {
        depth++
      }
      position = nextOpenEnd + 1
    } else {
      // No more tags found, but we haven't closed - malformed
      break
    }
  }

  // If we didn't find a proper closing tag, try simple approach
  const simpleCloseMatch = remainingContent.match(closeTagRegex)
  if (simpleCloseMatch) {
    const sectionContent = remainingContent.slice(0, simpleCloseMatch.index)
    return { content: sectionContent.trim(), scoped: isScoped }
  }

  // No closing tag found
  return { content: '', scoped: isScoped }
}

/**
 * Extracts component imports from .zph file content
 * Syntax: <import ComponentName from "./path.zph">
 * 
 * @param content - The content of the .zph file
 * @returns Array of import declarations
 */
function extractImports(content: string): Array<{ name: string; path: string }> {
  // Match: <import ComponentName from "./path.zph"> or <import ComponentName from './path.zph' />
  // Supports both single and double quotes, with or without self-closing
  const importRegex = /<import\s+(\w+)\s+from\s+["']([^"']+)["']\s*\/?>/gi
  const imports: Array<{ name: string; path: string }> = []

  let match
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      name: match[1]!,
      path: match[2]!
    })
  }

  return imports
}
