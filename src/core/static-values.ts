/**
 * Static Value Extraction
 * 
 * Extracts static values from reactive declarations in script
 * Example: let count: number = $(0) → { count: 0 }
 */

/**
 * Map of variable name to static value
 */
export type StaticValues = Map<string, any>

/**
 * Extracts static values from script code
 * Finds patterns like: let var = $(value)
 * 
 * @param script - The script code to analyze
 * @param props - Optional props to inject (overrides static values)
 * @returns Map of variable names to their static values
 */
export function extractStaticValues(script: string, props?: Record<string, any>): StaticValues {
  const values = new Map<string, any>()

  if (!script.trim()) {
    return values
  }

  // Pattern 1: let|const|var variableName: type? = $(value) (Reactive initial values)
  // Supports strings with parens and one level of nested parens
  const reactivePattern = /(?:let|const|var)\s+(\w+)(?::\s*[^=]+)?\s*=\s*\$\(((?:"[^"]*"|'[^']*'|\([^)]*\)|[^)(])*)\)/g

  // Pattern 2: const variableName = value (Static constants)
  // Simplified: Capture until semicolon or newline
  const staticPattern = /const\s+(\w+)\s*=\s*([^;\n]+)(?:;|\n|$)/g

  let match

  // Process reactive declarations
  // Process reactive declarations
  while ((match = reactivePattern.exec(script)) !== null) {
    if (match && match[1] && match[2]) {
      const variableName = match[1]
      const valueString = match[2].trim()
      try {
        const value = parseValue(valueString)
        values.set(variableName, value)
      } catch (error) {
        // Skip
      }
    }
  }

  // Process static constants
  while ((match = staticPattern.exec(script)) !== null) {
    if (match && match[1] && match[2]) {
      const variableName = match[1]
      const valueString = match[2].trim()

      // Skip $computed() declarations - these are handled separately
      if (valueString.startsWith('$computed')) {
        continue
      }

      if (!values.has(variableName)) {
        try {
          const value = parseValue(valueString)
          values.set(variableName, value)
        } catch (error) {
          // Skip
        }
      }
    }
  }

  // Inject props (overrides everything)
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      values.set(key, value)
    }
  }

  return values
}

/**
 * Parses a value string to its actual value
 * Handles: numbers, strings, booleans, null, undefined, objects, arrays
 */
function parseValue(valueString: string): any {
  const trimmed = valueString.trim()

  // Number
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    return Number(trimmed)
  }

  // Boolean
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Null
  if (trimmed === 'null') return null

  // Undefined
  if (trimmed === 'undefined') return undefined

  // String (quoted)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  // Template literal (backticks)
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1)
  }

  // Array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      // Simple array parsing (handles basic cases)
      const content = trimmed.slice(1, -1).trim()
      if (!content) return []

      // Split by comma, but handle nested structures
      const items: any[] = []
      let current = ''
      let depth = 0
      let inString = false
      let stringChar = ''

      for (let i = 0; i < content.length; i++) {
        const char = content[i]

        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true
          stringChar = char
          current += char
        } else if (inString && char === stringChar) {
          inString = false
          current += char
        } else if (!inString && char === '[') {
          depth++
          current += char
        } else if (!inString && char === ']') {
          depth--
          current += char
        } else if (!inString && char === '{') {
          depth++
          current += char
        } else if (!inString && char === '}') {
          depth--
          current += char
        } else if (!inString && char === ',' && depth === 0) {
          items.push(parseValue(current.trim()))
          current = ''
        } else {
          current += char
        }
      }

      if (current.trim()) {
        items.push(parseValue(current.trim()))
      }

      return items
    } catch {
      // If parsing fails, return as string (will be handled at runtime)
      return trimmed
    }
  }

  // Object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      // Simple object parsing (handles basic cases)
      return JSON.parse(trimmed)
    } catch {
      // If JSON.parse fails, it might be due to unquoted keys (JS object notation)
      // Try to quote keys: { key: "value" } -> { "key": "value" }
      try {
        // Regex to find unquoted keys: preceded by { or , and followed by :
        const fixed = trimmed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          // Also handle single quotes for values: 'value' -> "value"
          // This is risky for strings containing quotes, but we'll try basic cases
          .replace(/'/g, '"')

        return JSON.parse(fixed)
      } catch {
        // If that also fails, return as string
        return trimmed
      }
    }
  }

  // If we can't parse it, return as string
  // This will be left as-is in the template (handled in Phase 3)
  return trimmed
}
