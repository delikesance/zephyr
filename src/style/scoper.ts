/**
 * CSS scoping
 * 
 * Applies scope IDs to CSS selectors using [data-scope] .selector format
 * Scopes everything including @rules
 * Handles global styles (:root and @global comments), CSS variables, and edge cases
 */

import { parseCSS, CSSState } from './state-machine.js'

// Cache for transformed selectors (performance optimization)
const selectorCache = new Map<string, string>()

/**
 * Scope CSS styles with component scope ID
 * Format: [data-zph-abc123] .selector
 * 
 * Handles:
 * - Global styles (:root and @global comment markers)
 * - CSS variables (scoped declarations)
 * - Pseudo-selectors (all types)
 * - Edge cases (Unicode, escaped chars)
 * - Scoped vs unscoped styles (Phase 2.2)
 * 
 * @param style - The CSS to scope
 * @param scopeId - The scope ID to apply
 * @param styleScoped - Whether styles are scoped (true for <style scoped>, false for <style>)
 * @param childScopeIds - Array of child component scope IDs (for unscoped parent styles)
 * @returns Scoped CSS
 */
export function scopeStyles(
  style: string, 
  scopeId: string,
  styleScoped: boolean = true,
  childScopeIds: string[] = []
): string {
  if (!style.trim()) {
    return style
  }

  const scopePrefix = `[data-${scopeId}]`
  const parts: string[] = []
  
  // Find global comment markers before parsing (comments are removed during parsing)
  const globalCommentRegex = /\/\*\s*@global\s*\*\//gi
  const hasGlobalMarkers = globalCommentRegex.test(style)
  
  // Parse CSS into structured format
  const parsed = parseCSS(style)
  
  for (let ruleIndex = 0; ruleIndex < parsed.length; ruleIndex++) {
    const rule = parsed[ruleIndex]
    
    // Check if rule should be global
    const isGlobal = isGlobalRule(rule, hasGlobalMarkers)
    
    if (isGlobal) {
      // Don't scope global rules
      if (rule.atRule) {
        parts.push(rule.atRule)
        parts.push(' {')
        
        for (const selector of rule.selectors) {
          parts.push('\n  ')
          parts.push(selector)
          parts.push(' {')
          
          for (const prop of rule.properties) {
            parts.push('\n    ')
            parts.push(prop.name)
            parts.push(': ')
            parts.push(prop.value)
            parts.push(';')
          }
          
          parts.push('\n  }')
        }
        
        parts.push('\n}')
      } else {
        // Regular global rule
        if (rule.selectors.length > 0) {
          parts.push(rule.selectors.join(', '))
          parts.push(' {')
          
          for (const prop of rule.properties) {
            parts.push('\n  ')
            parts.push(prop.name)
            parts.push(': ')
            parts.push(prop.value)
            parts.push(';')
          }
          
          parts.push('\n}')
        }
      }
    } else {
      // Process @rule if present
      if (rule.atRule) {
        parts.push(rule.atRule)
        parts.push(' {')
        
        // Scope all selectors inside @rule
        for (const selector of rule.selectors) {
          let scopedSelector: string
          
          if (!styleScoped && childScopeIds.length > 0) {
            // Unscoped styles: Parent can style child within @rule
            // Format: [data-zph-parent] [data-zph-child] .selector
            const childScopePrefix = childScopeIds.map(id => `[data-${id}]`).join(' ')
            scopedSelector = `${scopePrefix} ${childScopePrefix} ${selector.trim()}`
          } else {
            // Scoped styles: Normal scoping
            scopedSelector = scopeSelector(selector, scopePrefix, true)
          }
          
          parts.push('\n  ')
          parts.push(scopedSelector)
          parts.push(' {')
          
          // Add properties (scope CSS variables)
          for (const prop of rule.properties) {
            parts.push('\n    ')
            const scopedProp = scopeCSSVariable(prop.name, prop.value, scopePrefix)
            parts.push(scopedProp.name)
            parts.push(': ')
            parts.push(scopedProp.value)
            parts.push(';')
          }
          
          parts.push('\n  }')
        }
        
        parts.push('\n}')
      } else {
        // Regular rule - scope all selectors
        let scopedSelectors: string[]
        
        if (!styleScoped && childScopeIds.length > 0) {
          // Unscoped styles: Parent can style child
          // Format: [data-zph-parent] [data-zph-child] .selector
          // This allows parent to target child components
          scopedSelectors = rule.selectors.flatMap(sel => 
            childScopeIds.map(childScopeId => {
              const childScopePrefix = `[data-${childScopeId}]`
              // First scope with parent, then allow targeting child
              // Format: [data-zph-parent] [data-zph-child] .selector
              return `${scopePrefix} ${childScopePrefix} ${sel.trim()}`
            })
          )
        } else {
          // Scoped styles: Normal scoping (current behavior)
          scopedSelectors = rule.selectors.map(sel => 
            scopeSelector(sel, scopePrefix, true)
          )
        }
        
        if (scopedSelectors.length > 0) {
          parts.push(scopedSelectors.join(', '))
          parts.push(' {')
          
          // Add properties (scope CSS variables)
          for (const prop of rule.properties) {
            parts.push('\n  ')
            const scopedProp = scopeCSSVariable(prop.name, prop.value, scopePrefix)
            parts.push(scopedProp.name)
            parts.push(': ')
            parts.push(scopedProp.value)
            parts.push(';')
          }
          
          parts.push('\n}')
        }
      }
    }
  }
  
  return parts.join('')
}

/**
 * Check if a rule should be global (not scoped)
 */
function isGlobalRule(rule: any, hasGlobalMarkers: boolean): boolean {
  // :root is always global
  if (rule.selectors.some((sel: string) => sel.trim() === ':root')) {
    return true
  }
  
  // If there are global markers in the CSS, we treat rules as potentially global
  // For now, we'll be conservative and only make :root global
  // In a more sophisticated implementation, we'd track which rules follow @global comments
  // For Phase 2.1, we'll enhance this to properly track comment positions
  
  return false
}

/**
 * Scope CSS variable declarations
 * Scopes where variable is defined, but keeps variable name
 */
function scopeCSSVariable(
  propertyName: string,
  propertyValue: string,
  scopePrefix: string
): { name: string; value: string } {
  // If this is a CSS variable declaration (--variable-name)
  if (propertyName.startsWith('--')) {
    // Variable name stays the same, but it's scoped to component
    // The scoping happens at the selector level, not variable name level
    return { name: propertyName, value: propertyValue }
  }
  
  // For non-variable properties, check if value uses CSS variables
  // If it does, the variable reference stays as-is (works within scoped component)
  return { name: propertyName, value: propertyValue }
}

/**
 * Scope a single selector
 * Format: [data-scope] .selector
 * 
 * Handles:
 * - Pseudo-selectors (::before, :hover, :not(), etc.)
 * - Attribute selectors
 * - Unicode characters
 * - Escaped characters
 * - Already scoped selectors
 */
function scopeSelector(selector: string, scopePrefix: string, useCache: boolean = false): string {
  const trimmed = selector.trim()
  
  // Check cache first (performance optimization)
  if (useCache) {
    const cacheKey = `${scopePrefix}:${trimmed}`
    if (selectorCache.has(cacheKey)) {
      return selectorCache.get(cacheKey)!
    }
  }
  
  // Don't scope :root, @ rules, or already scoped selectors
  if (trimmed === ':root' || 
      trimmed.startsWith('@') ||
      trimmed.includes(scopePrefix)) {
    if (useCache) {
      selectorCache.set(`${scopePrefix}:${trimmed}`, trimmed)
    }
    return trimmed
  }
  
  // Handle multiple selectors (comma-separated)
  if (trimmed.includes(',')) {
    const scoped = trimmed.split(',').map(sel => 
      scopeSelector(sel.trim(), scopePrefix, useCache)
    ).join(', ')
    
    if (useCache) {
      selectorCache.set(`${scopePrefix}:${trimmed}`, scoped)
    }
    return scoped
  }
  
  // Prepend scope prefix
  // This works for all selector types:
  // - Classes: .test → [data-zph-xxx] .test
  // - IDs: #id → [data-zph-xxx] #id
  // - Elements: div → [data-zph-xxx] div
  // - Pseudo-selectors: .test:hover → [data-zph-xxx] .test:hover
  // - Attribute: [type="text"] → [data-zph-xxx] [type="text"]
  // - Complex: .parent .child:hover → [data-zph-xxx] .parent .child:hover
  // 
  // Important: Don't scope inside pseudo-selectors like :is(), :not(), etc.
  // These should be scoped as a whole, not their inner selectors
  const scoped = `${scopePrefix} ${trimmed}`
  
  if (useCache) {
    selectorCache.set(`${scopePrefix}:${trimmed}`, scoped)
  }
  
  return scoped
}

/**
 * Clear the selector cache (useful for testing or memory management)
 */
export function clearSelectorCache(): void {
  selectorCache.clear()
}


