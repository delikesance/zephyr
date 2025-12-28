/**
 * Event Handler Compilation
 * 
 * Parses and compiles inline event handlers with automatic update injection
 * Phase 3.2: Inline handlers with update injection
 */

import { transformReactiveCode } from '../core/transformer.js'

export interface EventHandler {
  /** Event name (e.g., "onclick", "onchange") */
  eventName: string
  /** Original handler code */
  handlerCode: string
  /** Start position in template */
  start: number
  /** End position in template */
  end: number
  /** Compiled handler function name */
  functionName?: string
}

/**
 * Parse event handlers from template
 * Finds all inline event handlers like onclick="code"
 */
export function parseEventHandlers(template: string): EventHandler[] {
  const handlers: EventHandler[] = []

  if (!template.trim()) {
    return handlers
  }

  // Pattern: onxxx="code" or onxxx='code'
  const eventPattern = /on(\w+)=(["'])(.*?)\2/g

  let match
  while ((match = eventPattern.exec(template)) !== null) {
    const eventName = `on${match[1]}`
    const handlerCode = match[3] || ''
    const start = match.index
    const end = match.index + match[0].length

    handlers.push({
      eventName,
      handlerCode,
      start,
      end,
    })
  }

  return handlers
}

/**
 * Compile event handlers to JavaScript functions with update injection
 * 
 * @param handlers - Parsed event handlers
 * @param template - The template to modify
 * @param reactiveVars - Set of reactive variable names
 * @param scopeId - Component scope ID
 * @returns Compiled handler code and modified template
 */
export function compileEventHandlers(
  handlers: EventHandler[],
  template: string,
  reactiveVars: Set<string>,
  scopeId: string
): { handlerCode: string; modifiedTemplate: string } {
  if (handlers.length === 0) {
    return { handlerCode: '', modifiedTemplate: template }
  }

  const handlerFunctions: string[] = []
  let functionCounter = 0

  // Process each handler
  const handlerMap = new Map<number, { functionName: string }>()

  for (const handler of handlers) {
    // Include scopeId in function name to avoid conflicts across components
    const functionName = `handle${functionCounter++}_${scopeId.replace(/[^a-zA-Z0-9]/g, '')}`

    // Analyze handler code to detect mutations
    const mutations = detectMutations(handler.handlerCode, reactiveVars)

    // Generate handler function with update injection
    // Phase 4.2: Transform handler code (mutations -> wrapper calls)
    const transformedCode = transformReactiveCode(handler.handlerCode, reactiveVars)

    const compiledCode = generateHandlerFunction(
      functionName,
      transformedCode,
      mutations, // Phase 3.2 logic (we might remove this later if transformation handles everything)
      scopeId
    )

    handlerFunctions.push(compiledCode)
    handlerMap.set(handler.start, {
      functionName,
    })
  }

  // Replace inline handlers with function references
  const modifiedTemplate = replaceEventHandlers(template, handlers, handlerMap)

  return {
    handlerCode: handlerFunctions.join('\n\n'),
    modifiedTemplate,
  }
}

/**
 * Detect mutations in handler code
 * Returns list of variables that are mutated
 */
function detectMutations(
  handlerCode: string,
  reactiveVars: Set<string>
): Array<{ variable: string; isProperty: boolean; propertyPath?: string[] }> {
  const mutations: Array<{ variable: string; isProperty: boolean; propertyPath?: string[] }> = []

  // Pattern 1: variable++ or variable--
  for (const varName of reactiveVars) {
    const incrementPattern = new RegExp(`\\b${varName}\\s*[+]{2}|\\b${varName}\\s*[-]{2}`, 'g')
    if (incrementPattern.test(handlerCode)) {
      mutations.push({ variable: varName, isProperty: false })
    }
  }

  // Pattern 2: variable = value or variable += value, etc.
  for (const varName of reactiveVars) {
    const assignPattern = new RegExp(`\\b${varName}\\s*[=+\\-*/]`, 'g')
    if (assignPattern.test(handlerCode)) {
      mutations.push({ variable: varName, isProperty: false })
    }
  }

  // Pattern 3: object.property = value or object.property++
  for (const varName of reactiveVars) {
    const propertyPattern = new RegExp(`\\b${varName}\\.(\\w+(?:\\.\\w+)*)\\s*[=+\\-*/]`, 'g')
    let match
    while ((match = propertyPattern.exec(handlerCode)) !== null) {
      const propertyPath = match[1] ? match[1].split('.') : []
      mutations.push({
        variable: varName,
        isProperty: true,
        propertyPath,
      })
    }
  }

  return mutations
}

/**
 * Generate handler function with update injection
 */
function generateHandlerFunction(
  functionName: string,
  handlerCode: string,
  mutations: Array<{ variable: string; isProperty: boolean; propertyPath?: string[] }>,
  scopeId: string
): string {
  const capitalized = functionName.charAt(0).toUpperCase() + functionName.slice(1)

  // Build update calls
  const updateCalls: string[] = []

  for (const mutation of mutations) {
    if (mutation.isProperty && mutation.propertyPath) {
      // Property mutation - use property setter if available, otherwise update object
      const propPath = mutation.propertyPath.join('.')
      const setterName = `set${mutation.variable.charAt(0).toUpperCase() + mutation.variable.slice(1)}${mutation.propertyPath.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`

      // Check if setter exists (generated by reactivity system)
      // For now, we'll update the entire object
      const updateFunc = `update${mutation.variable.charAt(0).toUpperCase() + mutation.variable.slice(1)}DOM`
      updateCalls.push(`${updateFunc}(${mutation.variable});`)
    } else {
      // Direct variable mutation
      // Phase 4.2 Optimization: The wrapper function (count(val)) handles the update.
      // We don't need to explicitly call updateDOM here anymore if the code was transformed.
      // const updateFunc = `update${mutation.variable.charAt(0).toUpperCase() + mutation.variable.slice(1)}DOM`
      // updateCalls.push(`${updateFunc}(${mutation.variable}());`)
    }
  }

  // Output as window.handleX = function() { ... }
  // This ensures it's accessible from inline HTML attributes even when running as a module
  let funcCode = `window.${functionName} = function(event) {\n`
  funcCode += `  ${handlerCode}\n`

  if (updateCalls.length > 0) {
    funcCode += `  ${updateCalls.join('\n  ')}\n`
  }

  funcCode += `};`

  return funcCode
}

/**
 * Replace inline event handlers in template with function references
 */
export function replaceEventHandlers(
  template: string,
  handlers: EventHandler[],
  handlerMap: Map<number, { functionName: string }>
): string {
  let modified = template

  // Replace in reverse order to preserve positions
  const sortedHandlers = [...handlers].sort((a, b) => b.start - a.start)

  for (const handler of sortedHandlers) {
    const handlerInfo = handlerMap.get(handler.start)
    if (!handlerInfo) continue

    // Replace: onclick="code" with onclick="functionName.call(this, event)"
    // Find the exact match in the current template
    const original = modified.slice(handler.start, handler.end)
    const replacement = `${handler.eventName}="${handlerInfo.functionName}.call(this, event)"`

    modified = modified.slice(0, handler.start) + replacement + modified.slice(handler.end)
  }

  return modified
}
