/**
 * Template Directives
 * 
 * Parses and processes template directives (v-if, v-for, etc.)
 * Phase 3.2: Conditional rendering and loops
 */

export interface Directive {
  /** Directive name (e.g., "v-if", "v-for") */
  name: string
  /** Directive value/expression */
  value: string
  /** Element start position */
  elementStart: number
  /** Element end position */
  elementEnd: number
  /** Full element HTML */
  elementHTML: string
}

export interface ConditionalDirective extends Directive {
  name: '@if' | '@else'
  condition: string
}

export interface LoopDirective extends Directive {
  name: '@each'
  itemName: string
  arrayName: string
  indexName?: string
}

/**
 * Parse @if and @else directives from template
 */
export function parseConditionalDirectives(template: string): ConditionalDirective[] {
  const directives: ConditionalDirective[] = []

  if (!template.trim()) {
    return directives
  }

  // Pattern: <element @if="condition"> or <element @else>
  const ifPattern = /<(\w+)([^>]*?)\s+@if=["']([^"']+)["']([^>]*)>/g
  const elsePattern = /<(\w+)([^>]*?)\s+@else([^>]*)>/g

  let match
  while ((match = ifPattern.exec(template)) !== null) {
    const elementStart = match.index
    const elementTag = match[1]
    const condition = match[3]

    // Find matching closing tag
    const elementEnd = findMatchingClosingTag(template, elementStart, elementTag)

    if (elementEnd !== -1) {
      const elementHTML = template.slice(elementStart, elementEnd)

      directives.push({
        name: '@if',
        value: condition,
        condition,
        elementStart,
        elementEnd,
        elementHTML,
      })
    }
  }

  // Reset regex
  elsePattern.lastIndex = 0

  while ((match = elsePattern.exec(template)) !== null) {
    const elementStart = match.index
    const elementTag = match[1]

    // Find matching closing tag
    const elementEnd = findMatchingClosingTag(template, elementStart, elementTag)

    if (elementEnd !== -1) {
      const elementHTML = template.slice(elementStart, elementEnd)

      directives.push({
        name: '@else',
        value: '',
        condition: 'true', // @else is always true (opposite of previous @if)
        elementStart,
        elementEnd,
        elementHTML,
      })
    }
  }

  return directives
}

/**
 * Parse @each directive from template
 */
export function parseLoopDirectives(template: string): LoopDirective[] {
  const directives: LoopDirective[] = []

  if (!template.trim()) {
    return directives
  }

  // Pattern: <element @each="item in items">
  const eachPattern = /<(\w+)([^>]*?)\s+@each=["']([^"']+)["']([^>]*)>/g

  let match
  while ((match = eachPattern.exec(template)) !== null) {
    const elementStart = match.index
    const elementTag = match[1]
    const directiveName = '@each'
    const forExpression = match[3]

    // Parse: "item in items" or "(item, index) in items"
    const forMatch = forExpression.match(/^\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+in\s+(\w+)$/)
    if (!forMatch) {
      continue // Invalid syntax
    }

    const itemName = forMatch[1]
    const indexName = forMatch[2]
    const arrayName = forMatch[3]

    // Find matching closing tag
    const elementEnd = findMatchingClosingTag(template, elementStart, elementTag)

    if (elementEnd !== -1) {
      const elementHTML = template.slice(elementStart, elementEnd)

      directives.push({
        name: directiveName,
        value: forExpression,
        itemName,
        arrayName,
        indexName,
        elementStart,
        elementEnd,
        elementHTML,
      })
    }
  }

  return directives
}

/**
 * Find matching closing tag for an opening tag
 */
function findMatchingClosingTag(
  template: string,
  startPos: number,
  tagName: string
): number {
  let depth = 1
  let i = startPos + 1

  // Skip to end of opening tag
  while (i < template.length && template[i] !== '>') {
    i++
  }
  if (i >= template.length) return -1

  i++ // Skip '>'

  // Find matching closing tag
  while (i < template.length) {
    if (template[i] === '<') {
      if (i + 1 < template.length && template[i + 1] === '/') {
        // Closing tag
        const closingTagMatch = template.slice(i + 2).match(/^(\w+)\s*>/)
        if (closingTagMatch && closingTagMatch[1] === tagName) {
          depth--
          if (depth === 0) {
            // Found matching closing tag
            return i + 2 + closingTagMatch[0].length
          }
        }
      } else {
        // Opening tag - check if it's the same tag (nested)
        const openingTagMatch = template.slice(i + 1).match(/^(\w+)/)
        if (openingTagMatch && openingTagMatch[1] === tagName) {
          depth++
        }
      }
    }
    i++
  }

  return -1
}

/**
 * Generate conditional rendering code
 */
export function generateConditionalCode(
  directives: ConditionalDirective[],
  scopeId: string
): { js: string; modifiedTemplate: string } {
  if (directives.length === 0) {
    return { js: '', modifiedTemplate: '' }
  }

  // Group @if and @else pairs
  const conditionalGroups: ConditionalDirective[][] = []
  let currentGroup: ConditionalDirective[] = []

  for (const directive of directives) {
    if (directive.name === '@if') {
      if (currentGroup.length > 0) {
        conditionalGroups.push(currentGroup)
      }
      currentGroup = [directive]
    } else if (directive.name === '@else') {
      currentGroup.push(directive)
    }
  }

  if (currentGroup.length > 0) {
    conditionalGroups.push(currentGroup)
  }

  // Generate code for each group
  const jsCode: string[] = []
  let modifiedTemplate = ''

  for (const group of conditionalGroups) {
    const ifDirective = group.find(d => d.name === '@if')!
    const elseDirective = group.find(d => d.name === '@else')

    // Generate unique IDs for elements
    const ifId = `conditional-${Math.random().toString(36).substr(2, 9)}`
    const elseId = elseDirective ? `conditional-${Math.random().toString(36).substr(2, 9)}` : null

    // Generate rendering function
    const funcName = `renderConditional${ifId.replace(/[^a-zA-Z0-9]/g, '')}`

    let funcCode = `function ${funcName}() {\n`
    funcCode += `  const condition = ${ifDirective.condition};\n`
    funcCode += `  const ifElement = document.querySelector('[data-${scopeId}] [data-conditional="${ifId}"]');\n`

    if (elseDirective) {
      funcCode += `  const elseElement = document.querySelector('[data-${scopeId}] [data-conditional="${elseId}"]');\n`
      funcCode += `  if (condition) {\n`
      funcCode += `    if (ifElement) ifElement.style.display = '';\n`
      funcCode += `    if (elseElement) elseElement.style.display = 'none';\n`
      funcCode += `  } else {\n`
      funcCode += `    if (ifElement) ifElement.style.display = 'none';\n`
      funcCode += `    if (elseElement) elseElement.style.display = '';\n`
      funcCode += `  }\n`
    } else {
      funcCode += `  if (ifElement) {\n`
      funcCode += `    ifElement.style.display = condition ? '' : 'none';\n`
      funcCode += `  }\n`
    }

    funcCode += `}\n`
    funcCode += `${funcName}(); // Initial render\n`

    jsCode.push(funcCode)
  }

  return {
    js: jsCode.join('\n'),
    modifiedTemplate, // Will be modified by caller
  }
}

/**
 * Generate loop rendering code
 */
export function generateLoopCode(
  directives: LoopDirective[],
  scopeId: string,
  template: string,
  reactiveVars?: Set<string>
): { js: string; modifiedTemplate: string; globalExports: string[] } {
  if (directives.length === 0) {
    return { js: '', modifiedTemplate: template, globalExports: [] }
  }

  const jsCode: Array<{ funcCode: string; globalExports: string[] }> = []
  let modifiedTemplate = template
  const allGlobalExports: string[] = []

  for (const directive of directives) {
    // Generate unique ID for loop container
    const loopId = `loop-${Math.random().toString(36).substr(2, 9)}`

    // Extract template HTML (without directive) for JS generation
    // Remove @each attribute but DON'T add data-loop to the template HTML
    // (data-loop is only for the placeholder, not for generated items)
    let templateHTML = directive.elementHTML
      .replace(/\s+@each=["'][^"']+["']/g, '') // Remove @each attribute

    // Detect function calls in the ORIGINAL template HTML (before interpolation processing)
    // This is important because we need to find function names like "selectColor" in onclick="selectColor(...)"
    const functionCalls = new Set<string>()
    const functionCallPattern = /\b(\w+)\s*\(/g
    // Check both the original elementHTML and the processed templateHTML
    const htmlToCheck = directive.elementHTML
    let funcMatch
    while ((funcMatch = functionCallPattern.exec(htmlToCheck)) !== null) {
      const funcName = funcMatch[1]
      // Skip known built-ins, reactive vars, and the loop item variable
      // Note: 'emit' is handled separately by generateEventEmitter
      if (funcName && funcName !== directive.itemName && 
          !['currentColor', 'emit', 'console', 'document', 'window', 'Array', 'String', 'Number', 'Object', 'parseInt', 'parseFloat'].includes(funcName) &&
          !reactiveVars?.has(funcName) &&
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(funcName)) { // Valid identifier
        functionCalls.add(funcName)
      }
    }
    
    // Also check for style attribute interpolation issues
    // The templateHTML might have {{ color }} in style="background: {{ color }}"
    // We need to make sure this gets transformed to ${color} in the template literal

    // Process template interpolations: {{ var }} -> ${var} for template literal
    // Also handle reactive variables: {{ currentColor }} -> ${currentColor()}
    templateHTML = templateHTML.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      const trimmed = expr.trim()
      
      // Transform reactive variable references in expressions
      // e.g., "color === currentColor" -> "color === currentColor()"
      let transformed = trimmed
      
      // Find all variable references in the expression
      // Match word boundaries to avoid partial matches
      if (reactiveVars) {
        for (const reactiveVar of reactiveVars) {
          // Replace variable references that are not already function calls
          // Match: word boundary, var name, not followed by ( or .
          const varPattern = new RegExp(`\\b${reactiveVar}\\b(?!\\s*\\()`, 'g')
          transformed = transformed.replace(varPattern, `${reactiveVar}()`)
        }
      }
      
      // For loop item variable, it's already available in the forEach scope
      // No transformation needed for the item variable itself
      
      return `\${${transformed}}`
    })

    // Modify the actual template to add data-loop attribute and remove @each
    // We construct a regex to match the specific directive instance
    const startTagRegex = new RegExp(`<(\\w+)([^>]*?)\\s+@each=["']${escapeRegex(directive.value)}["']([^>]*)>`)

    modifiedTemplate = modifiedTemplate.replace(startTagRegex, (match, tag, before, after) => {
      // Remove style attributes with {{ }} interpolation from placeholder
      // They'll be added back by the loop render function with proper values
      let cleanedBefore = before
      let cleanedAfter = after
      // Remove style="..." that contains {{ }} from before or after parts
      cleanedBefore = cleanedBefore.replace(/\s+style=["'][^"']*\{\{[^}]+\}[^"']*["']/gi, '')
      cleanedAfter = cleanedAfter.replace(/\s+style=["'][^"']*\{\{[^}]+\}[^"']*["']/gi, '')
      // Also remove class attributes with {{ }} from placeholder (they'll be regenerated)
      cleanedBefore = cleanedBefore.replace(/\s+class=["'][^"']*\{\{[^}]+\}[^"']*["']/gi, '')
      cleanedAfter = cleanedAfter.replace(/\s+class=["'][^"']*\{\{[^}]+\}[^"']*["']/gi, '')
      // Reconstruct tag with data-loop and without @each
      return `<${tag}${cleanedBefore} data-loop="${loopId}"${cleanedAfter}>`
    })

    // Generate rendering function
    const funcName = `renderLoop${loopId.replace(/[^a-zA-Z0-9]/g, '')}`

    // Check if array is reactive (function) or constant
    const isReactiveArray = reactiveVars && reactiveVars.has(directive.arrayName)
    const arrayAccess = isReactiveArray ? `${directive.arrayName}()` : directive.arrayName

    // Detect which reactive variables are used in the loop template
    const usedReactiveVars: string[] = []
    if (reactiveVars) {
      // Always include the array variable itself (so loop re-renders when array changes)
      if (reactiveVars.has(directive.arrayName)) {
        usedReactiveVars.push(directive.arrayName)
      }
      // Also include other reactive variables used in the template
      for (const reactiveVar of reactiveVars) {
        // Check if the reactive variable is referenced in the template HTML
        // Look for the variable name in expressions (not just as the loop item)
        if (reactiveVar !== directive.itemName && reactiveVar !== directive.arrayName && templateHTML.includes(reactiveVar)) {
          usedReactiveVars.push(reactiveVar)
        }
      }
    }

    // Find the parent container selector - use the parent of the loop element
    // We'll store this in a variable that persists across renders
    const parentSelectorVar = `_loopParent_${loopId.replace(/[^a-zA-Z0-9]/g, '')}`
    
    let funcCode = `function ${funcName}() {\n`
    funcCode += `  // Find the container (placeholder with data-loop attribute)\n`
    funcCode += `  const container = document.querySelector('[data-${scopeId}] [data-loop="${loopId}"]');\n`
    funcCode += `  let parent;\n`
    funcCode += `  \n`
    funcCode += `  if (container) {\n`
    funcCode += `    // First render: container exists, get its parent\n`
    funcCode += `    parent = container.parentElement;\n`
    funcCode += `    if (!parent) return;\n`
    funcCode += `    // Store parent reference for future renders\n`
    funcCode += `    window.${parentSelectorVar} = parent;\n`
    funcCode += `    // Remove the placeholder container\n`
    funcCode += `    container.remove();\n`
    funcCode += `  } else {\n`
    funcCode += `    // Subsequent renders: container was removed, use stored parent\n`
    funcCode += `    parent = window.${parentSelectorVar};\n`
    funcCode += `    if (!parent) {\n`
    funcCode += `      // Fallback: try to find parent by traversing from first generated item\n`
    funcCode += `      // First, check if placeholder still exists (shouldn't happen, but handle it)\n`
    funcCode += `      const loopContainer = document.querySelector('[data-${scopeId}] [data-loop="${loopId}"]');\n`
    funcCode += `      if (loopContainer) {\n`
    funcCode += `        parent = loopContainer.parentElement;\n`
    funcCode += `        // Remove the placeholder if it still exists\n`
    funcCode += `        loopContainer.remove();\n`
    funcCode += `      } else {\n`
    funcCode += `        // Try to find parent by looking for elements with history-item class within scope\n`
    funcCode += `        const scopeElement = document.querySelector('[data-${scopeId}]');\n`
    funcCode += `        if (scopeElement) {\n`
    funcCode += `          // First, try to find the parent by looking for common container classes\n`
    funcCode += `          // This is more reliable when the list is empty (no items to find)\n`
    funcCode += `          const historyList = scopeElement.querySelector('.history-list, .list, [class*="list"]');\n`
    funcCode += `          if (historyList) {\n`
    funcCode += `            parent = historyList;\n`
    funcCode += `          } else {\n`
    funcCode += `            // Look for the first history-item or similar element to find its parent\n`
    funcCode += `            const firstItem = scopeElement.querySelector('.history-item, [class*="item"]');\n`
    funcCode += `            if (firstItem) {\n`
    funcCode += `              parent = firstItem.parentElement;\n`
    funcCode += `            } else {\n`
    funcCode += `              // Last resort: find any element with the loop ID's parent structure\n`
    funcCode += `              // Look for elements that might be children of the loop container\n`
    funcCode += `              const anyChild = scopeElement.querySelector('[data-${scopeId}] > * > *');\n`
    funcCode += `              if (anyChild) parent = anyChild.parentElement;\n`
    funcCode += `            }\n`
    funcCode += `          }\n`
    funcCode += `        }\n`
    funcCode += `      }\n`
    funcCode += `      if (!parent) {\n`
    funcCode += `        console.error('Could not find parent element for loop ${loopId}');\n`
    funcCode += `        return;\n`
    funcCode += `      }\n`
    funcCode += `      // Store it for next time\n`
    funcCode += `      window.${parentSelectorVar} = parent;\n`
    funcCode += `    }\n`
    funcCode += `  }\n`
    funcCode += `  \n`
    funcCode += `  // Always clear existing items before rendering (prevents duplication)\n`
    funcCode += `  // Also remove any remaining placeholder elements that might still exist\n`
    funcCode += `  if (parent) {\n`
    funcCode += `    // Remove any placeholder elements that might still exist\n`
    funcCode += `    const remainingPlaceholder = parent.querySelector('[data-loop="${loopId}"]');\n`
    funcCode += `    if (remainingPlaceholder) {\n`
    funcCode += `      remainingPlaceholder.remove();\n`
    funcCode += `    }\n`
    funcCode += `    // Clear all content\n`
    funcCode += `    parent.innerHTML = '';\n`
    funcCode += `  }\n`
    funcCode += `  \n`
    funcCode += `  const items = ${arrayAccess};\n`
    funcCode += `  if (!Array.isArray(items)) return;\n`
    funcCode += `  \n`
    funcCode += `  // Optimized rendering: build HTML string and set once (batches DOM operations)\n`
    funcCode += `  const htmlParts = [];\n`
    funcCode += `  items.forEach((${directive.itemName}${directive.indexName ? `, ${directive.indexName}` : ''}) => {\n`
    funcCode += `    htmlParts.push(\`${templateHTML}\`);\n`
    funcCode += `  });\n`
    funcCode += `  \n`
    funcCode += `  // Single DOM update: set all HTML at once (much faster than multiple appends)\n`
    funcCode += `  // Always set innerHTML, even if empty, to ensure placeholder is cleared\n`
    funcCode += `  if (parent) {\n`
    funcCode += `    parent.innerHTML = htmlParts.join('');\n`
    funcCode += `  }\n`
    funcCode += `}\n`
    funcCode += `${funcName}(); // Initial render\n`

    // Generate invalidation hooks for reactive variables used in the loop
    if (usedReactiveVars.length > 0) {
      funcCode += `\n// Re-render loop when reactive variables change\n`
      for (const reactiveVar of usedReactiveVars) {
        const capitalized = reactiveVar.charAt(0).toUpperCase() + reactiveVar.slice(1)
        funcCode += `(function() {\n`
        funcCode += `  const _original_update${capitalized}DOM = update${capitalized}DOM;\n`
        funcCode += `  update${capitalized}DOM = function(value) {\n`
        funcCode += `    _original_update${capitalized}DOM(value);\n`
        funcCode += `    ${funcName}();\n`
        funcCode += `  };\n`
        funcCode += `})();\n`
      }
    }

    // Make functions used in loop-generated HTML globally accessible
    // We'll return this separately so it can be added right after function definitions
    const globalExports: string[] = []
    if (functionCalls.size > 0) {
      for (const funcName of functionCalls) {
        globalExports.push(`window.${funcName} = ${funcName};`)
      }
      allGlobalExports.push(...globalExports)
    }

    jsCode.push({ funcCode, globalExports })
  }

  return {
    js: jsCode.map(item => item.funcCode).join('\n'),
    modifiedTemplate,
    globalExports: allGlobalExports,
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape template string for use in JavaScript template literal
 * Also transforms {{ expression }} into ${expression} for runtime interpolation
 */
function escapeTemplate(template: string): string {
  return template
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${')
    .replace(/{{([\s\S]+?)}}/g, '${$1}')
}
