/**
 * CSS State Machine Parser
 * 
 * Robust CSS parser using state machine approach
 * Handles: selectors, properties, values, @rules, comments, strings
 */

export enum CSSState {
  SELECTOR,      // Reading selector
  PROPERTY,      // Reading property name
  VALUE,         // Reading property value
  COMMENT,       // Inside /* comment */
  AT_RULE,       // Inside @media, @keyframes, etc.
  STRING,        // Inside quoted string
  BETWEEN,       // Between rules (whitespace, etc.)
}

export interface CSSParseResult {
  selectors: string[]
  properties: Array<{ name: string; value: string }>
  atRule?: string
  atRuleContent?: string
}

/**
 * Parses CSS into structured format
 * This is used by the scoper to understand CSS structure
 */
export function parseCSS(css: string): CSSParseResult[] {
  const results: CSSParseResult[] = []
  let state: CSSState = CSSState.BETWEEN
  let currentSelector = ''
  let currentProperty = ''
  let currentValue = ''
  let currentAtRule = ''
  let braceDepth = 0
  let inString = false
  let stringChar = ''
  let i = 0
  const len = css.length
  
  const currentRule: CSSParseResult = {
    selectors: [],
    properties: [],
  }
  
  while (i < len) {
    const char = css[i]
    const nextChar = css[i + 1]
    
    // Handle comments
    if (char === '/' && nextChar === '*' && state !== CSSState.STRING) {
      state = CSSState.COMMENT
      i += 2
      // Skip until */
      while (i < len - 1 && !(css[i] === '*' && css[i + 1] === '/')) {
        i++
      }
      if (i < len - 1) i += 2 // Skip */
      continue
    }
    
    if (state === CSSState.COMMENT) {
      i++
      continue
    }
    
    // Handle strings (in values and selectors - for attribute selectors)
    if ((char === '"' || char === "'") && state !== CSSState.COMMENT) {
      if (!inString) {
        inString = true
        stringChar = char
        // Add quote to current context (value or selector)
        if (state === CSSState.VALUE) {
          currentValue += char
        } else if (state === CSSState.SELECTOR) {
          currentSelector += char
        }
      } else if (char === stringChar) {
        inString = false
        // Add closing quote to current context
        if (state === CSSState.VALUE) {
          currentValue += char
        } else if (state === CSSState.SELECTOR) {
          currentSelector += char
        }
      } else {
        // Different quote type, add to current context
        if (state === CSSState.VALUE) {
          currentValue += char
        } else if (state === CSSState.SELECTOR) {
          currentSelector += char
        }
      }
      i++
      continue
    }
    
    if (inString) {
      // Inside string, add to current context
      if (state === CSSState.VALUE) {
        currentValue += char
      } else if (state === CSSState.SELECTOR) {
        currentSelector += char
      }
      i++
      continue
    }
    
    // Handle @rules
    if (char === '@' && state === CSSState.BETWEEN) {
      state = CSSState.AT_RULE
      currentAtRule = '@'
      i++
      // Read @rule name
      while (i < len && /[a-zA-Z-]/.test(css[i])) {
        currentAtRule += css[i]
        i++
      }
      // Skip whitespace
      while (i < len && /\s/.test(css[i])) {
        i++
      }
      // Read @rule parameters (until {)
      let atRuleParams = ''
      while (i < len && css[i] !== '{') {
        atRuleParams += css[i]
        i++
      }
      currentAtRule += atRuleParams.trim()
      currentRule.atRule = currentAtRule
      if (css[i] === '{') {
        braceDepth = 1
        state = CSSState.SELECTOR // Inside @rule, treat as selector context
        i++
      }
      continue
    }
    
    // Handle braces
    if (char === '{') {
      braceDepth++
      // If we're reading a selector or between rules, save the selector
      if (state === CSSState.SELECTOR || state === CSSState.BETWEEN) {
        // Save selector before opening brace
        const selector = currentSelector.trim()
        if (selector) {
          // Handle multiple selectors (comma-separated)
          const selectors = selector.split(',').map(s => s.trim()).filter(s => s)
          currentRule.selectors.push(...selectors)
        }
        currentSelector = ''
        state = CSSState.PROPERTY
      }
      i++
      continue
    }
    
    if (char === '}') {
      braceDepth--
      
      // Save current property if any
      if (currentProperty.trim() && currentValue.trim()) {
        currentRule.properties.push({
          name: currentProperty.trim(),
          value: currentValue.trim(),
        })
        currentProperty = ''
        currentValue = ''
      }
      
      if (braceDepth === 0) {
        // End of rule
        if (currentRule.selectors.length > 0 || currentRule.properties.length > 0) {
          results.push({ ...currentRule })
        }
        // Reset
        currentRule.selectors = []
        currentRule.properties = []
        currentRule.atRule = undefined
        currentRule.atRuleContent = undefined
        state = CSSState.BETWEEN
      } else if (currentRule.atRule) {
        // Still inside @rule
        state = CSSState.SELECTOR
      } else {
        state = CSSState.BETWEEN
      }
      i++
      continue
    }
    
    // Handle colon (property: value separator)
    if (char === ':' && state === CSSState.PROPERTY && braceDepth > 0) {
      state = CSSState.VALUE
      i++
      continue
    }
    
    // Handle semicolon (end of property)
    if (char === ';' && state === CSSState.VALUE && braceDepth > 0) {
      if (currentProperty.trim() && currentValue.trim()) {
        currentRule.properties.push({
          name: currentProperty.trim(),
          value: currentValue.trim(),
        })
      }
      currentProperty = ''
      currentValue = ''
      state = CSSState.PROPERTY
      i++
      continue
    }
    
    // Collect characters based on state
    if (state === CSSState.SELECTOR || 
        (state === CSSState.AT_RULE && braceDepth > 0) ||
        (state === CSSState.BETWEEN && !/\s/.test(char))) {
      // Start reading selector if we encounter non-whitespace in BETWEEN state
      if (state === CSSState.BETWEEN && !/\s/.test(char)) {
        state = CSSState.SELECTOR
        currentSelector = char
      } else {
        currentSelector += char
      }
    } else if (state === CSSState.PROPERTY) {
      if (char !== ':' && !/\s/.test(char)) {
        currentProperty += char
      } else if (/\s/.test(char) && currentProperty.trim()) {
        // Property name complete, wait for :
        // (handled by colon check above)
      }
    } else if (state === CSSState.VALUE) {
      currentValue += char
    }
    
    i++
  }
  
  // Handle any remaining rule
  if (currentRule.selectors.length > 0 || currentRule.properties.length > 0) {
    results.push(currentRule)
  }
  
  return results
}
