/**
 * Reactive Reference Parser
 * 
 * Parses templates to identify reactive references in {{ }} syntax
 * Uses state machine approach for robust parsing
 */

export interface ReactiveReference {
  /** The full match including {{ }} */
  fullMatch: string
  /** The expression inside {{ }} */
  expression: string
  /** Start position in template */
  start: number
  /** End position in template */
  end: number
  /** Whether this is raw HTML ({{{ }}} or {{@ }}) */
  isRaw: boolean
  /** Variable name (if simple variable) */
  variableName?: string
  /** Property path (if property access like user.name) */
  propertyPath?: string[]
}

/**
 * Parse template to find all reactive references
 * 
 * @param template - The template to parse
 * @returns Array of reactive references found
 */
export function parseReactiveReferences(template: string): ReactiveReference[] {
  const references: ReactiveReference[] = []

  if (!template) {
    return references
  }

  let i = 0
  const len = template.length
  let state: 'normal' | 'inInterpolation' | 'inRawInterpolation' = 'normal'
  let interpolationStart = -1
  let expressionStart = -1
  let braceCount = 0

  while (i < len) {
    const char = template[i]
    const nextChar = template[i + 1]
    const nextNextChar = template[i + 2]

    if (state === 'normal') {
      // Look for {{ or {{{ or {{@
      if (char === '{' && nextChar === '{') {
        if (nextNextChar === '{') {
          // Raw HTML: {{{
          state = 'inRawInterpolation'
          interpolationStart = i
          expressionStart = i + 3
          braceCount = 3
          i += 3
          continue
        } else if (nextNextChar === '@') {
          // Raw HTML: {{@
          state = 'inRawInterpolation'
          interpolationStart = i
          expressionStart = i + 3
          braceCount = 2 // {{@ closes with }}
          i += 3
          continue
        } else {
          // Normal interpolation: {{
          state = 'inInterpolation'
          interpolationStart = i
          expressionStart = i + 2
          braceCount = 2
          i += 2
          continue
        }
      }
    } else if (state === 'inInterpolation' || state === 'inRawInterpolation') {
      // For raw interpolation with {{{, look for }}}
      if (state === 'inRawInterpolation' && braceCount === 3 && char === '}' && nextChar === '}' && template[i + 2] === '}') {
        // Found closing }}}
        const expression = template.slice(expressionStart, i).trim()
        const fullMatch = template.slice(interpolationStart, i + 3)
        const isRaw = true

        // Parse expression to extract variable name and property path
        const parsed = parseExpression(expression)

        references.push({
          fullMatch,
          expression,
          start: interpolationStart,
          end: i + 3,
          isRaw,
          variableName: parsed.variableName,
          propertyPath: parsed.propertyPath,
        })

        state = 'normal'
        i += 3
        continue
      }

      // For raw interpolation with {{@, look for }}
      if (state === 'inRawInterpolation' && braceCount === 2 && char === '}' && nextChar === '}') {
        // Found closing }}
        const expression = template.slice(expressionStart, i).trim()
        const fullMatch = template.slice(interpolationStart, i + 2)
        const isRaw = true

        // Parse expression to extract variable name and property path
        const parsed = parseExpression(expression)

        references.push({
          fullMatch,
          expression,
          start: interpolationStart,
          end: i + 2,
          isRaw,
          variableName: parsed.variableName,
          propertyPath: parsed.propertyPath,
        })

        state = 'normal'
        i += 2
        continue
      }

      // For normal interpolation, look for }}
      if (state === 'inInterpolation' && char === '}' && nextChar === '}') {
        // Found closing }}
        const expression = template.slice(expressionStart, i).trim()
        const fullMatch = template.slice(interpolationStart, i + 2)
        const isRaw = false

        // Parse expression to extract variable name and property path
        const parsed = parseExpression(expression)

        references.push({
          fullMatch,
          expression,
          start: interpolationStart,
          end: i + 2,
          isRaw,
          variableName: parsed.variableName,
          propertyPath: parsed.propertyPath,
        })

        state = 'normal'
        i += 2
        continue
      }
    }

    i++
  }

  return references
}

/**
 * Parse an expression to extract variable name and property path
 * Handles: variable, variable.property, variable.property.subproperty
 */
function parseExpression(expression: string): {
  variableName?: string
  propertyPath?: string[]
} {
  const trimmed = expression.trim()

  // Simple variable: "count"
  if (/^\w+$/.test(trimmed)) {
    return { variableName: trimmed }
  }

  // Property access: "user.name" or "obj.prop.subprop"
  // BUT we must stop if we see a method call like "items.map(...)"
  const firstParen = trimmed.indexOf('(')

  // If there's a function call, we just want the base variable for dependency tracking
  // We DON'T want to track the method chain as specific properties for setters
  if (firstParen !== -1) {
    const preParen = trimmed.slice(0, firstParen)
    const dotIndex = preParen.indexOf('.')

    if (dotIndex > 0) {
      // It's a method call on a property/variable like "items.map"
      // We just return the variable name "items"
      const variableName = preParen.slice(0, dotIndex).trim()
      if (/^\w+$/.test(variableName)) {
        return { variableName }
      }
    } else {
      // Direct function call "func()"
      // If it's a variable call, we might track it? For now, just extract name
      // Phase 3.1 is simple reactivity.
      const variableName = preParen.trim()
      if (/^\w+$/.test(variableName)) {
        return { variableName }
      }
    }
  } else {
    // Standard property access without function calls
    const dotIndex = trimmed.indexOf('.')
    if (dotIndex > 0) {
      const variableName = trimmed.slice(0, dotIndex).trim()
      const propertyPath = trimmed.slice(dotIndex + 1)
        .split('.')
        .map(p => p.trim())
        .filter(p => p.length > 0)

      if (/^\w+$/.test(variableName)) {
        return { variableName, propertyPath }
      }
    }
  }

  // Complex expression fallback
  const firstVarMatch = trimmed.match(/^\w+/)
  if (firstVarMatch) {
    return { variableName: firstVarMatch[0] }
  }

  return {}
}
