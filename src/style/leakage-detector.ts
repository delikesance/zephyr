/**
 * Style leakage detection
 * 
 * Detects potential style leakage issues and generates warnings
 * Phase 2.2: Warns on global selectors and overly broad selectors
 */

import { parseCSS } from './state-machine.js'
import type { WarningCollector } from '../core/errors.js'

/**
 * Detects potential style leakage and adds warnings
 * 
 * @param style - The CSS to analyze
 * @param scopeId - The component scope ID (for context)
 * @param componentName - The component name (for context)
 * @param warnings - Warning collector to add warnings to
 */
export function detectLeakage(
  style: string,
  scopeId: string,
  componentName: string,
  warnings: WarningCollector
): void {
  if (!style.trim()) {
    return
  }

  const parsed = parseCSS(style)
  
  for (const rule of parsed) {
    // Skip global rules (they're intentional)
    if (isGlobalRule(rule)) {
      continue
    }
    
    // Check each selector in the rule
    for (const selector of rule.selectors) {
      const trimmed = selector.trim()
      
      // Check for global selectors without :root
      if (isGlobalSelector(trimmed)) {
        warnings.add({
          type: 'warning',
          message: `Potential style leakage: Global selector "${trimmed}" should use :root or /* @global */`,
          file: componentName,
          suggestion: `Use :root { ... } or add /* @global */ comment before the rule to make it explicitly global`,
        })
      }
      
      // Check for overly broad selectors
      if (isOverlyBroad(trimmed)) {
        warnings.add({
          type: 'warning',
          message: `Potential style leakage: Overly broad selector "${trimmed}" may affect other components`,
          file: componentName,
          suggestion: `Consider using a more specific selector or adding a class/ID to scope it better`,
        })
      }
    }
  }
}

/**
 * Check if a rule is global (intentionally global)
 */
function isGlobalRule(rule: any): boolean {
  // :root is always global
  return rule.selectors.some((sel: string) => sel.trim() === ':root')
}

/**
 * Check if a selector is a global selector (body, html, *)
 */
function isGlobalSelector(selector: string): boolean {
  const trimmed = selector.trim()
  
  // Check for body
  if (/^\s*body(\s|,|$|\s*[>+~]|\s*{|\.|#|\[)/i.test(trimmed)) {
    return true
  }
  
  // Check for html
  if (/^\s*html(\s|,|$|\s*[>+~]|\s*{|\.|#|\[)/i.test(trimmed)) {
    return true
  }
  
  // Check for universal selector (*)
  if (/^\s*\*(\s|,|$|\s*[>+~]|\s*{|\.|#|\[)/.test(trimmed)) {
    return true
  }
  
  return false
}

/**
 * Check if a selector is overly broad (may affect other components)
 */
function isOverlyBroad(selector: string): boolean {
  const trimmed = selector.trim()
  
  // Single element selectors without classes/IDs are too broad
  // Examples: "div", "p", "span", "a", etc.
  // But not: ".class", "#id", "div.class", "[attr]", etc.
  
  // Match single word element selectors (div, p, span, etc.)
  // But exclude if it has class (.), ID (#), attribute ([), or pseudo-selector (:)
  const singleElementPattern = /^[a-z]+(\s|,|$|>|\+|~)/i
  
  if (singleElementPattern.test(trimmed)) {
    // Check if it has any scoping (class, ID, attribute, pseudo)
    const hasScoping = /[.#\[:]/.test(trimmed)
    return !hasScoping
  }
  
  // Universal selector (*) is always too broad (unless in :root)
  if (trimmed === '*' || trimmed.startsWith('* ')) {
    return true
  }
  
  return false
}
