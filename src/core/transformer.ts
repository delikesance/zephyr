/**
 * Reactivity Transformer
 * 
 * Transforms reactive variable usage into wrapper function calls
 * Phase 4.2: Code transformation
 */

/**
 * Transform script code to use reactive wrapper functions
 * 
 * @param code - Original code
 * @param reactiveVars - Set of reactive variable names
 * @returns Transformed code
 */
export function transformReactiveCode(code: string, reactiveVars: Set<string>): string {
    if (!code.trim() || reactiveVars.size === 0) {
        return code
    }

    let transformed = code

    for (const varName of reactiveVars) {
        // 1. Transform increments/decrements: count++ -> count(count() + 1)
        // Note: This is a simplistic regex approach. A real AST parser would be safer but heavier.
        // We match: boundary, varName, whitespace, ++
        const incRegex = new RegExp(`\\b${varName}\\s*\\+\\+`, 'g')
        transformed = transformed.replace(incRegex, `${varName}(${varName}() + 1)`)

        const preIncRegex = new RegExp(`\\+\\+\\s*${varName}\\b`, 'g')
        transformed = transformed.replace(preIncRegex, `${varName}(${varName}() + 1)`)

        const decRegex = new RegExp(`\\b${varName}\\s*--`, 'g')
        transformed = transformed.replace(decRegex, `${varName}(${varName}() - 1)`)

        const preDecRegex = new RegExp(`--\\s*${varName}\\b`, 'g')
        transformed = transformed.replace(preDecRegex, `${varName}(${varName}() - 1)`)

        // 2. Transform assignments: count = 5 -> count(5)
        // We look for: varName, whitespace, =, whitespace, value
        // This is tricky because value can be an expression. 
        // We'll trust that the statement ends with ; or newline or }
        // Ideally we assume simple assignments for now or rely on the fact that
        // in Zephyr, we encourage simple mutations.

        // Match: count = ...
        // Limitation: This regex might capture too much or too little. 
        // It captures until the next semicolon, newline, or end of string.
        const assignRegex = new RegExp(`\\b${varName}\\s*=\\s*([^;\\n]+)`, 'g')
        transformed = transformed.replace(assignRegex, (match, value) => {
            // If we are inside a declaration like 'let count = $(0)', we should NOT transform.
            // But this function is supposed to run effectively *after* or *around* declarations are processed?
            // Actually, 'processReactivity' handles declarations separately.
            // But we must ensure we don't double-transform the initial declaration if it's still present.
            // However, processReactivity replaces definitions with _private vars.
            // So this transformer should run on the *rest* of the code.

            return `${varName}(${value})`
        })

        // 3. Transform compound assignments: count += 5 -> count(count() + 5)
        const addAssignRegex = new RegExp(`\\b${varName}\\s*\\+=\\s*([^;\\n]+)`, 'g')
        transformed = transformed.replace(addAssignRegex, `${varName}(${varName}() + $1)`)

        const subAssignRegex = new RegExp(`\\b${varName}\\s*-=\\s*([^;\\n]+)`, 'g')
        transformed = transformed.replace(subAssignRegex, `${varName}(${varName}() - $1)`)

        // 4. Transform reads: count -> count()
        // This is the hardest part with regex because we must avoid matching:
        // - count(...) (already a call)
        // - function count (declaration)
        // - .count (property access)
        // - count: (object key)

        // Look for varName NOT followed by ( or = or :
        // and NOT preceded by . or function or class or let/const/var
        // const readRegex = new RegExp(`(?<![.\\w])\\b${varName}\\b(?!\\s*[(=:])`, 'g')
        // Safari/older JS engines don't support lookbehind. Bun does.

        // We need to be careful not to re-transform things we just transformed (like count(count() + 1))
        // So maybe we do reads first? Or last?
        // If we do reads last:
        // count(5) -> match count? Yes, followed by (. No match.
        // count() -> No match.
        // console.log(count) -> Match! -> console.log(count())

        const readRegex = new RegExp(`(?<![.\\w$_])\\b${varName}\\b(?!\\s*[(=\\w])`, 'g')
        transformed = transformed.replace(readRegex, `${varName}()`)
    }

    return transformed
}
