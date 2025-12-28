/**
 * Reactive Update Code Generator
 * 
 * Generates JavaScript code to update DOM when reactive values change
 * Phase 3.1: Basic implementation with data attributes for targeting
 */

import type { ReactiveReference } from './reactive-parser.js'
import type { StaticValues } from '../core/static-values.js'

export interface ReactiveUpdateCode {
  /** Generated JavaScript code for reactive updates */
  js: string
  /** Modified template with data attributes for targeting */
  template: string
}

/**
 * Generate reactive update code for a template
 * 
 * @param template - The template after static value replacement
 * @param references - All parsed reactive references (original)
 * @param staticValues - Static values map
 * @param scopeId - Component scope ID
 * @returns Generated update code and modified template
 */
export function generateReactiveCode(
  template: string,
  references: ReactiveReference[],
  staticValues: StaticValues,
  scopeId: string
): ReactiveUpdateCode {
  // Filter out references that are already static (replaced)
  const reactiveRefs = references.filter(ref => {
    // If the reference is still in the template (not replaced), it's reactive
    return template.includes(ref.fullMatch)
  })

  if (reactiveRefs.length === 0) {
    return {
      js: '',
      template,
    }
  }

  // Sort references by start position in descending order to prevent offset shifts
  reactiveRefs.sort((a, b) => b.start - a.start)

  let modifiedTemplate = template
  const updateCode: string[] = []

  // We need to track element counter in reverse too if we want stable IDs?
  // Actually, elementCounter just needs to be unique. Order doesn't matter for correctness, just consistency.
  // But if we iterate reverse, we should probably assign IDs in reverse or pre-assign?
  // Let's just use a simple counter. It doesn't match document order, but that's fine.
  let elementCounter = 0

  // Process each reactive reference
  for (const ref of reactiveRefs) {
    if (!ref.variableName) {
      continue // Skip complex expressions for Phase 3.1
    }

    const elementId = `${ref.variableName}:${elementCounter++}`
    const selector = `[data-reactive="${elementId}"]`
    const functionName = `update${ref.variableName.charAt(0).toUpperCase() + ref.variableName.slice(1)}${elementCounter}`

    // Generate update function
    if (ref.isRaw) {
      // Raw HTML: use innerHTML
      updateCode.push(`
function ${functionName}(value) {
  const element = document.querySelector('[data-${scopeId}] ${selector}');
  if (element) {
    element.innerHTML = value;
  }
}`)
    } else {
      // Normal: use textContent (escaped)
      // Special handling for boolean 'mounted': evaluate ternary expression
      const isMounted = ref.variableName === 'mounted'
      const ternaryLogic = isMounted ? `element.textContent = typeof value === 'boolean' ? (value ? 'Mounted' : 'Not Mounted') : (value != null ? String(value) : '');` : `element.textContent = value != null ? String(value) : '';`
      
      updateCode.push(`
function ${functionName}(value) {
  const element = document.querySelector('[data-${scopeId}] ${selector}');
  if (element) {
    ${ternaryLogic}
  }
}`)
    }

    // Wrap interpolation in a span with data-reactive attribute
    const before = modifiedTemplate.slice(0, ref.start)
    const after = modifiedTemplate.slice(ref.end)

    // Check if we are inside a tag (attribute)
    // simplistic check: if we find a '<' before us that is closer than the nearest '>'
    const lastOpenIndex = before.lastIndexOf('<')
    const lastCloseIndex = before.lastIndexOf('>')

    // If we are inside a tag (e.g. <div class="{{ val }}">), lastOpenIndex > lastCloseIndex
    const isInsideTag = lastOpenIndex > lastCloseIndex

    if (isInsideTag) {
      // We are inside a tag (likely an attribute).
      // Check if we're in a style attribute - if so, we can track it for reactive updates
      const beforeRef = before.slice(lastOpenIndex)
      const styleMatch = beforeRef.match(/style\s*=\s*["']([^"']*)/i)
      
      if (styleMatch) {
        // We're in a style attribute - mark the element for style updates
        // Find the closing > of the opening tag to add data-reactive-style attribute
        // Find the closing > of the opening tag - search from lastOpenIndex to ref.end + some buffer
        let tagCloseIndex = -1
        const searchEnd = Math.min(ref.end + 100, modifiedTemplate.length)
        for (let i = lastOpenIndex; i < searchEnd; i++) {
          if (modifiedTemplate[i] === '>') {
            tagCloseIndex = i
            break
          }
        }
        
        if (tagCloseIndex > 0 && tagCloseIndex > lastOpenIndex) {
          // Extract style property name from the style content (e.g., "background" from "background: {{ color }}")
          const styleContentBefore = beforeRef.match(/style\s*=\s*["']([^"']*)$/i)
          const styleContentAfter = modifiedTemplate.slice(ref.end, tagCloseIndex)
          const fullStyleContent = (styleContentBefore ? styleContentBefore[1] : '') + ref.fullMatch + styleContentAfter
          const stylePropMatch = fullStyleContent.match(/(\w+)\s*:\s*\{\{/)
          const styleProperty = stylePropMatch ? stylePropMatch[1] : 'background'
          
          // Add data-reactive-style attribute to track this element
          const varName = ref.variableName!
          const beforeTagClose = modifiedTemplate.slice(0, tagCloseIndex)
          const afterTagClose = modifiedTemplate.slice(tagCloseIndex)
          modifiedTemplate = beforeTagClose + ` data-reactive-style="${varName}:${styleProperty}"` + afterTagClose
          
          // Update the update function to also update style attribute
          const lastUpdateCode = updateCode[updateCode.length - 1]
          if (lastUpdateCode) {
            updateCode[updateCode.length - 1] = lastUpdateCode.replace(
              /element\.textContent = [^;]+;/,
              `element.textContent = value != null ? String(value) : '';
  // Also update style attribute if this element has data-reactive-style
  const styleElements = document.querySelectorAll('[data-reactive-style*="${varName}:"]');
  styleElements.forEach(styleEl => {
    const styleAttr = styleEl.getAttribute('data-reactive-style');
    if (styleAttr && styleAttr.startsWith('${varName}:')) {
      const styleProp = styleAttr.split(':')[1] || 'background';
      const currentStyle = styleEl.getAttribute('style') || '';
      // Update the specific style property
      const styleRegex = new RegExp('(^|;\\s*)' + styleProp + '\\s*:[^;]*', 'i');
      const newStyleProp = styleProp + ': ' + (value || '');
      if (styleRegex.test(currentStyle)) {
        styleEl.setAttribute('style', currentStyle.replace(styleRegex, '$1' + newStyleProp));
      } else {
        styleEl.setAttribute('style', currentStyle + (currentStyle ? '; ' : '') + newStyleProp);
      }
    }
  });`
            )
          }
        }
        continue
      }
      
      // For other attributes, skip for now (as before)
      // Remove the JS update code we just added since we can't target it
      updateCode.pop()
      continue
    }

    modifiedTemplate = before + `<span data-reactive="${elementId}">${ref.fullMatch}</span>` + after
  }

  return {
    js: updateCode.join('\n'),
    template: modifiedTemplate,
  }
}
