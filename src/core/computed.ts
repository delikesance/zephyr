/**
 * Computed Properties System
 * 
 * Processes $computed() declarations and generates reactive computed values
 * Computed values automatically update when their dependencies change
 * 
 * Phase 4.3: Component Logic
 */

export interface ComputedVariable {
    /** Variable name */
    name: string
    /** The function body/expression */
    expression: string
    /** Explicit dependencies (if provided) */
    explicitDeps: string[]
    /** Whether dependencies were explicitly specified */
    hasExplicitDeps: boolean
}

/**
 * Find all computed variable declarations in script
 * 
 * Patterns:
 * - const fullName = $computed(() => firstName + lastName)
 * - const fullName = $computed(() => firstName + lastName, [firstName, lastName])
 */
export function findComputedVariables(script: string): Map<string, ComputedVariable> {
    const vars = new Map<string, ComputedVariable>()

    // Find all $computed declarations with proper parsing
    // Pattern to find start: const/let/var name = $computed(
    const declarationPattern = /(?:let|const|var)\s+(\w+)(?:\s*:\s*[^=]+)?\s*=\s*\$computed\s*\(/g

    let match
    while ((match = declarationPattern.exec(script)) !== null) {
        const variableName = match[1]!
        const startOfArgs = match.index + match[0].length

        // Parse the arguments using proper bracket matching
        let parenDepth = 1
        let pos = startOfArgs
        let arrowPos = -1
        let expressionStart = -1
        let expressionEnd = -1
        let depsStart = -1
        let depsEnd = -1

        // Find the arrow function: () =>
        while (pos < script.length && arrowPos === -1) {
            if (script.slice(pos, pos + 2) === '=>') {
                arrowPos = pos
                expressionStart = pos + 2
                break
            }
            pos++
        }

        if (arrowPos === -1) continue

        // Skip whitespace after =>
        pos = expressionStart
        while (pos < script.length && /\s/.test(script[pos]!)) {
            pos++
        }
        expressionStart = pos

        // Now track brackets to find end of expression
        parenDepth = 0
        let bracketDepth = 0
        let braceDepth = 0
        let inString = false
        let stringChar = ''

        while (pos < script.length) {
            const char = script[pos]!
            const prevChar = pos > 0 ? script[pos - 1] : ''

            // Handle strings
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true
                    stringChar = char
                } else if (char === stringChar) {
                    inString = false
                }
            }

            if (!inString) {
                if (char === '(') parenDepth++
                else if (char === ')') {
                    if (parenDepth === 0) {
                        // End of $computed()
                        expressionEnd = pos
                        break
                    }
                    parenDepth--
                }
                else if (char === '[') bracketDepth++
                else if (char === ']') bracketDepth--
                else if (char === '{') braceDepth++
                else if (char === '}') braceDepth--
                else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                    // Found comma at top level - marks end of expression, start of deps
                    expressionEnd = pos
                    depsStart = pos + 1
                }
            }
            pos++
        }

        if (expressionEnd === -1) expressionEnd = pos

        let expression = script.slice(expressionStart, expressionEnd).trim()
        let explicitDeps: string[] = []
        let hasExplicitDeps = false

        // Parse deps if present
        if (depsStart !== -1) {
            // Find the deps array
            const depsSection = script.slice(depsStart, pos)
            const depsMatch = depsSection.match(/\[\s*([^\]]*)\s*\]/)
            if (depsMatch) {
                hasExplicitDeps = true
                explicitDeps = depsMatch[1]!
                    .split(',')
                    .map(d => d.trim())
                    .filter(d => d.length > 0)
            }
        }

        vars.set(variableName, {
            name: variableName,
            expression,
            explicitDeps,
            hasExplicitDeps,
        })
    }

    return vars
}

/**
 * Infer dependencies from a computed expression
 * Looks for reactive variable references in the expression
 */
export function inferDependencies(
    expression: string,
    reactiveVars: Set<string>
): string[] {
    const deps: string[] = []

    for (const varName of reactiveVars) {
        // Check if the variable is used in the expression
        // Match: varName as a word boundary (can be followed by () or not)
        const pattern = new RegExp(`\\b${varName}\\b`, 'g')
        if (pattern.test(expression)) {
            deps.push(varName)
        }
    }

    return deps
}

/**
 * Process computed variables in script
 * Transforms $computed() declarations into reactive getters
 */
export function processComputedVariables(
    script: string,
    reactiveVars: Set<string>,
    scopeId: string
): { processedScript: string; computedCode: string[] } {
    const computedVars = findComputedVariables(script)

    if (computedVars.size === 0) {
        return { processedScript: script, computedCode: [] }
    }

    let processedScript = script
    const computedCode: string[] = []

    // Get all computed variable names for expression transformation
    const computedVarNames = new Set(computedVars.keys())

    // Build dependency map: which computed vars depend on which reactive vars
    const dependencyMap = new Map<string, string[]>() // reactive var -> computed vars that depend on it

    // Also track computed-to-computed dependencies
    const computedDependencyMap = new Map<string, string[]>() // computed var -> computed vars that depend on it

    for (const [varName, varInfo] of computedVars) {
        // Determine reactive dependencies
        const reactiveDeps = varInfo.hasExplicitDeps
            ? varInfo.explicitDeps
            : inferDependencies(varInfo.expression, reactiveVars)

        // Also find computed dependencies (other computed vars referenced in this expression)
        const computedDeps = inferDependencies(varInfo.expression, computedVarNames)

        // Record reactive dependencies for invalidation
        for (const dep of reactiveDeps) {
            if (!dependencyMap.has(dep)) {
                dependencyMap.set(dep, [])
            }
            dependencyMap.get(dep)!.push(varName)
        }

        // Record computed dependencies for invalidation
        for (const dep of computedDeps) {
            if (dep !== varName) { // Don't add self-dependency
                if (!computedDependencyMap.has(dep)) {
                    computedDependencyMap.set(dep, [])
                }
                computedDependencyMap.get(dep)!.push(varName)
            }
        }

        // Replace the declaration
        // const fullName = $computed(() => ...) -> // computed: fullName
        const declarationPattern = new RegExp(
            `(let|const|var)\\s+${varName}(?:\\s*:\\s*[^=]+)?\\s*=\\s*\\$computed\\s*\\([^)]+(?:\\)\\s*\\))?`,
            'g'
        )

        processedScript = processedScript.replace(declarationPattern, `// computed: ${varName}`)

        // Transform the expression: convert computed variable references to function calls
        const transformedExpression = transformComputedReferences(varInfo.expression, computedVarNames, reactiveVars)

        // Generate computed getter function  
        computedCode.push(generateComputedGetter(varName, transformedExpression, [...reactiveDeps, ...computedDeps], scopeId))
    }

    // Generate invalidation wiring code for reactive -> computed
    const invalidationCode = generateInvalidationWiring(dependencyMap)
    if (invalidationCode) {
        computedCode.push(invalidationCode)
    }

    // Generate invalidation wiring for computed -> computed
    const computedInvalidationCode = generateComputedToComputedWiring(computedDependencyMap)
    if (computedInvalidationCode) {
        computedCode.push(computedInvalidationCode)
    }

    return { processedScript, computedCode }
}

/**
 * Generate code to wire computed invalidation to reactive setters
 */
function generateInvalidationWiring(dependencyMap: Map<string, string[]>): string {
    if (dependencyMap.size === 0) return ''

    const parts: string[] = ['// Wire up computed invalidation']

    for (const [reactiveVar, computedVars] of dependencyMap) {
        // Generate code that saves the original setter and wraps it
        const invalidations = computedVars
            .map(cv => `invalidate${cv.charAt(0).toUpperCase() + cv.slice(1)}()`)
            .join('; ')

        parts.push(`
// When ${reactiveVar} changes, invalidate: ${computedVars.join(', ')}
(function() {
  const _original_${reactiveVar} = ${reactiveVar};
  ${reactiveVar} = function(value) {
    if (arguments.length > 0) {
      const result = _original_${reactiveVar}.apply(this, arguments);
      ${invalidations};
      return result;
    }
    return _original_${reactiveVar}.apply(this, arguments);
  };
})();`)
    }

    return parts.join('\n')
}

/**
 * Generate code to wire computed-to-computed invalidation
 */
function generateComputedToComputedWiring(dependencyMap: Map<string, string[]>): string {
    if (dependencyMap.size === 0) return ''

    const parts: string[] = ['// Wire up computed-to-computed invalidation']

    for (const [sourceVar, dependentVars] of dependencyMap) {
        const capitalized = sourceVar.charAt(0).toUpperCase() + sourceVar.slice(1)
        const invalidations = dependentVars
            .map(dv => `invalidate${dv.charAt(0).toUpperCase() + dv.slice(1)}()`)
            .join('; ')

        parts.push(`
// When computed ${sourceVar} is invalidated, also invalidate: ${dependentVars.join(', ')}
(function() {
  const _original_invalidate${capitalized} = typeof invalidate${capitalized} !== 'undefined' ? invalidate${capitalized} : null;
  if (_original_invalidate${capitalized}) {
    invalidate${capitalized} = function() {
      _original_invalidate${capitalized}();
      ${invalidations};
    };
  }
})();`)
    }

    return parts.join('\n')
}

/**
 * Transform variable references in expression to function calls
 * Both reactive vars and computed vars are functions, so we need to call them
 */
function transformComputedReferences(
    expression: string,
    computedVars: Set<string>,
    reactiveVars: Set<string>
): string {
    let result = expression

    // All variables that need to be called as functions
    const allFunctionVars = new Set([...computedVars, ...reactiveVars])

    for (const varName of allFunctionVars) {
        // Match variable name not already followed by ( and not preceded by .
        // This regex finds: varName not followed by ( and not part of a larger word
        const pattern = new RegExp(
            `(?<![.\\w])${varName}(?!\\s*\\()(?![\\w])`,
            'g'
        )
        result = result.replace(pattern, `${varName}()`)
    }

    return result
}

/**
 * Generate getter function for a computed property
 */
function generateComputedGetter(
    varName: string,
    expression: string,
    deps: string[],
    scopeId: string
): string {
    const capitalized = varName.charAt(0).toUpperCase() + varName.slice(1)

    // Cached value and dirty flag
    let code = `
// Computed property: ${varName}
let _${varName}_cached;
let _${varName}_dirty = true;

function ${varName}() {
  if (_${varName}_dirty) {
    _${varName}_cached = ${expression};
    _${varName}_dirty = false;
  }
  return _${varName}_cached;
}

// Invalidate cache when dependencies change
function invalidate${capitalized}() {
  _${varName}_dirty = true;
  update${capitalized}DOM();
}

// DOM update for computed property
function update${capitalized}DOM() {
  const value = ${varName}();
  const selector = '[data-${scopeId}] [data-reactive*="${varName}"], [data-${scopeId}][data-reactive*="${varName}"]';
  const elements = document.querySelectorAll(selector);
  elements.forEach(element => {
    const reactiveAttr = element.getAttribute('data-reactive');
    if (reactiveAttr && reactiveAttr.includes('${varName}')) {
      element.textContent = value != null ? String(value) : '';
    }
  });
}

// Initialize computed value on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', update${capitalized}DOM);
} else {
  update${capitalized}DOM();
}`

    return code
}

/**
 * Generate code to wire up computed invalidation when dependencies change
 * This hooks into the existing reactive update functions
 */
export function generateComputedInvalidationHooks(
    computedVars: Map<string, ComputedVariable>,
    reactiveVars: Set<string>
): string {
    const hooks: string[] = []

    for (const [varName, varInfo] of computedVars) {
        const deps = varInfo.hasExplicitDeps
            ? varInfo.explicitDeps
            : inferDependencies(varInfo.expression, reactiveVars)

        const capitalized = varName.charAt(0).toUpperCase() + varName.slice(1)

        // For each dependency, we need to call invalidate when it changes
        for (const dep of deps) {
            const depCapitalized = dep.charAt(0).toUpperCase() + dep.slice(1)
            hooks.push(`// ${dep} -> ${varName}: Add invalidation to update${depCapitalized}DOM`)
        }
    }

    return hooks.join('\n')
}
