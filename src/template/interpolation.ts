/**
 * Template Interpolation Processing
 * 
 * Processes {{ }} syntax and replaces with static values when known
 * Also handles raw HTML syntax: {{{ }}} or {{@ }}
 */

import type { StaticValues } from '../core/static-values.js'
import { parseReactiveReferences } from './reactive-parser.js'

/**
 * Processes template interpolation, replacing static values
 * Leaves reactive values for runtime handling
 * 
 * @param template - The template with {{ }} interpolations
 * @param staticValues - Map of variable names to static values
 * @returns Template with static values replaced, reactive values left for runtime
 */
export function processInterpolation(template: string, staticValues: StaticValues): string {
  if (!template) {
    return template
  }

  // Parse all reactive references
  const references = parseReactiveReferences(template)

  if (references.length === 0) {
    return template
  }

  // Process each reference
  let processed = template
  let offset = 0 // Track offset from replacements

  for (const ref of references) {
    const adjustedStart = ref.start + offset
    const adjustedEnd = ref.end + offset
    const match = processed.slice(adjustedStart, adjustedEnd)

    const trimmed = ref.expression.trim()
    let replacement = match // Default: leave as-is

    // Try to replace with static value
    if (staticValues.has(trimmed)) {
      const value = staticValues.get(trimmed)
      replacement = formatValue(value, ref.isRaw)
    } else {
      // Property access (e.g., "obj.property" or "obj.prop.subprop")
      const dotIndex = trimmed.indexOf('.')
      if (dotIndex > 0) {
        const baseVar = trimmed.slice(0, dotIndex).trim()
        const propertyPath = trimmed.slice(dotIndex + 1).trim()

        // Check if it's a simple property access (no parentheses for function calls)
        const isSimpleProperty = /^[a-zA-Z0-9_$.]+$/.test(propertyPath)

        if (isSimpleProperty && staticValues.has(baseVar)) {
          const obj = staticValues.get(baseVar)
          if (typeof obj === 'object' && obj !== null) {
            // Navigate property path (e.g., "name" or "user.name")
            const properties = propertyPath.split('.')
            let value: any = obj

            for (const prop of properties) {
              if (value && typeof value === 'object' && prop in value) {
                value = (value as any)[prop]
              } else {
                value = undefined
                break
              }
            }

            if (value !== undefined) {
              replacement = formatValue(value, ref.isRaw)
            }
          }
        }
      }

      // If replacement hasn't changed (still original string) and we have static values,
      // try to evaluate the expression as JavaScript code.
      // This handles cases like: items.map(...), count + 1, etc.
      if (replacement === match && staticValues.size > 0) {
        try {
          // Create a function with all static values as arguments
          const keys = Array.from(staticValues.keys())
          const values = Array.from(staticValues.values())

          // Use new Function to evaluate the expression
          // Safety: This runs in the build process, so we assume component code is trusted
          const fn = new Function(...keys, `return (${trimmed})`)
          const result = fn(...values)

          // Only replace if result is valid (not undefined/nan logic might imply failure)
          // Actually undefined -> empty string is valid for templates
          if (result !== undefined) {
            replacement = formatValue(result, ref.isRaw)
          }
        } catch (error) {
          // Evaluation failed (e.g. references missing variable, or syntax error in template)
          // Keep original replacement (original string)
        }
      }
    }

    // Replace in template
    const before = processed.slice(0, adjustedStart)
    const after = processed.slice(adjustedEnd)
    processed = before + replacement + after

    // Update offset
    offset += replacement.length - match.length
  }

  return processed
}

/**
 * Formats a value for insertion into HTML
 * 
 * @param value - The value to format
 * @param isRaw - Whether this is raw HTML (no escaping)
 */
function formatValue(value: any, isRaw: boolean = false): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    // Raw HTML: don't escape
    if (isRaw) {
      return value
    }
    // Normal: escape HTML entities
    return escapeHtml(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'object') {
    // For objects/arrays, stringify
    const stringified = JSON.stringify(value)
    if (isRaw) {
      return stringified
    }
    return escapeHtml(stringified)
  }

  return String(value)
}

/**
 * Escapes HTML entities
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}
