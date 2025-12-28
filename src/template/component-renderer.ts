/**
 * Component renderer for templates
 * 
 * Replaces <ComponentName /> with compiled component HTML and injects instance IDs
 * Phase 3.2: Supports props and slots
 */

import type { ResolvedImport } from '../core/import-resolver.js'
import { parseComponentProps, extractSlotContent, replaceSlot } from './props-slots.js'

/**
 * Process component imports in template
 * 
 * Replaces <ComponentName /> with compiled component HTML
 * Injects instance-specific scope IDs for state isolation
 * 
 * @param template - The template content
 * @param imports - Resolved component imports
 * @param parentScopeId - The parent component's scope ID
 * @returns Processed template with components rendered
 */
export function renderComponents(
  template: string,
  imports: ResolvedImport[],
  parentScopeId: string
): string {
  if (imports.length === 0) {
    return template
  }

  let processed = template

  // Process each import
  for (const imp of imports) {
    // Generate unique instance ID for each usage
    // Format: {baseInstanceId}-{counter}
    const baseInstanceId = imp.instanceId
    let instanceCounter = 0
    
    // Find all instances of <ComponentName /> (self-closing)
    const selfClosingRegex = new RegExp(
      `<${imp.importName}(\\s[^>]*)?\\s*/>`,
      'gi'
    )
    
    processed = processed.replace(selfClosingRegex, (match) => {
      instanceCounter++
      const uniqueInstanceId = `${baseInstanceId}-${instanceCounter}`
      const instanceAttr = `data-instance="${uniqueInstanceId}"`
      
      // Parse props from the tag
      const propsInfo = parseComponentProps(match)
      const props = propsInfo?.props || new Map()
      
      // Get compiled component HTML
      let componentHTML = imp.compiled.html
      
      // Process props: Replace {{ propName }} in component template with prop values
      if (props.size > 0) {
        for (const [propName, propValue] of props) {
          // Replace prop references in template
          const propPattern = new RegExp(`\\{\\{\\s*props\\.${propName}\\s*\\}\\}`, 'g')
          componentHTML = componentHTML.replace(propPattern, propValue)
          
          // Also support direct prop name: {{ propName }}
          const directPropPattern = new RegExp(`\\{\\{\\s*${propName}\\s*\\}\\}`, 'g')
          componentHTML = componentHTML.replace(directPropPattern, propValue)
        }
      }
      
      // Add instance attribute to root element
      if (componentHTML.trim().startsWith('<')) {
        // Find the first opening tag and add instance attribute
        componentHTML = componentHTML.replace(
          /^(\s*<[^\s>]+)(\s|>)/,
          `$1 ${instanceAttr}$2`
        )
      } else {
        // Wrap in div if no root element
        componentHTML = `<div ${instanceAttr}>${componentHTML}</div>`
      }

      return componentHTML
    })
    
    // Handle opening/closing tag pairs: <ComponentName>...</ComponentName>
    // Process from end to start to avoid index shifting issues
    const openTagPattern = `<${imp.importName}(\\s[^>]*)?>`
    const closeTagPattern = `</${imp.importName}>`
    
    // Find all matches and process in reverse order
    const openMatches: Array<{ index: number; match: string }> = []
    let openMatch
    const openRegex = new RegExp(openTagPattern, 'gi')
    while ((openMatch = openRegex.exec(processed)) !== null) {
      openMatches.push({ index: openMatch.index, match: openMatch[0] })
    }
    
    // Process in reverse to avoid index shifting
    for (let i = openMatches.length - 1; i >= 0; i--) {
      const { index: openIndex, match: openTag } = openMatches[i]
      
      // Find matching closing tag after this opening tag
      const afterOpen = processed.slice(openIndex + openTag.length)
      const closeRegex = new RegExp(closeTagPattern, 'i')
      const closeMatch = closeRegex.exec(afterOpen)
      
      if (closeMatch) {
        instanceCounter++
        const uniqueInstanceId = `${baseInstanceId}-${instanceCounter}`
        const instanceAttr = `data-instance="${uniqueInstanceId}"`
        
        // Extract slot content (content between opening and closing tags)
        const slotContentStart = openIndex + openTag.length
        const slotContentEnd = openIndex + openTag.length + closeMatch.index
        const slotContent = processed.slice(slotContentStart, slotContentEnd).trim()
        
        // Parse props from the opening tag
        const propsInfo = parseComponentProps(openTag)
        const props = propsInfo?.props || new Map()
        
        let componentHTML = imp.compiled.html
        
        // Process props: Replace {{ propName }} in component template with prop values
        if (props.size > 0) {
          for (const [propName, propValue] of props) {
            // Replace prop references in template
            const propPattern = new RegExp(`\\{\\{\\s*props\\.${propName}\\s*\\}\\}`, 'g')
            componentHTML = componentHTML.replace(propPattern, propValue)
            
            // Also support direct prop name: {{ propName }}
            const directPropPattern = new RegExp(`\\{\\{\\s*${propName}\\s*\\}\\}`, 'g')
            componentHTML = componentHTML.replace(directPropPattern, propValue)
          }
        }
        
        // Process slot: Replace <slot> with actual content (or remove if empty)
        componentHTML = replaceSlot(componentHTML, slotContent)
        
        if (componentHTML.trim().startsWith('<')) {
          componentHTML = componentHTML.replace(
            /^(\s*<[^\s>]+)(\s|>)/,
            `$1 ${instanceAttr}$2`
          )
        } else {
          componentHTML = `<div ${instanceAttr}>${componentHTML}</div>`
        }
        
        // Replace opening tag and content with component HTML
        const beforeOpen = processed.slice(0, openIndex)
        const afterClose = processed.slice(openIndex + openTag.length + closeMatch.index + closeMatch[0].length)
        processed = beforeOpen + componentHTML + afterClose
      }
    }
  }

  return processed
}

/**
 * Collect all child component scope IDs from imports
 * Used for unscoped parent styles
 * 
 * @param imports - Resolved component imports
 * @returns Array of child scope IDs
 */
export function collectChildScopeIds(imports: ResolvedImport[]): string[] {
  return imports.map(imp => imp.component.scopeId)
}
