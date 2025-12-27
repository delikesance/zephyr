/**
 * Zephyr Expression Compiler
 * 
 * Compiles and evaluates JavaScript expressions in a sandboxed context.
 * Uses function parameter injection instead of deprecated `with` statement.
 */

// =============================================================================
// HTML Escaping
// =============================================================================

const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(str: string): string {
    if (typeof str !== 'string') return String(str);
    return str.replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPE_MAP[char]);
}

// =============================================================================
// Expression Variable Extraction
// =============================================================================

/**
 * Extract potential variable identifiers from an expression.
 * Strips string literals first to avoid extracting identifiers from strings.
 */
const STRING_LITERAL_REGEX = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const IDENTIFIER_REGEX = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;

// JavaScript keywords and built-ins that should NOT be treated as context variables
const JS_RESERVED = new Set([
    // Keywords
    'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
    'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends',
    'import', 'super', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static', 'yield', 'await', 'async',
    // Literals
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    // Global objects
    'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Math',
    'Number', 'Object', 'RegExp', 'String', 'Map', 'Set', 'WeakMap',
    'WeakSet', 'Promise', 'Symbol', 'Proxy', 'Reflect', 'Intl',
    'ArrayBuffer', 'DataView', 'Float32Array', 'Float64Array',
    'Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array', 'Uint16Array',
    'Uint32Array', 'BigInt', 'BigInt64Array', 'BigUint64Array',
    // Global functions
    'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
    'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
    // Console
    'console',
]);

export function extractVariables(expression: string): string[] {
    const variables = new Set<string>();
    
    // Remove string literals to avoid extracting identifiers from them
    const stripped = expression.replace(STRING_LITERAL_REGEX, '""');
    
    let match: RegExpExecArray | null;
    
    // Reset regex state
    IDENTIFIER_REGEX.lastIndex = 0;
    
    while ((match = IDENTIFIER_REGEX.exec(stripped)) !== null) {
        const identifier = match[1];
        if (!JS_RESERVED.has(identifier)) {
            variables.add(identifier);
        }
    }
    
    return Array.from(variables).sort();
}

// =============================================================================
// Caches
// =============================================================================

interface CompiledExpression {
    fn: Function;
    variables: string[];
}

const expressionCache = new Map<string, CompiledExpression>();
const scriptCache = new Map<string, CompiledExpression>();

// =============================================================================
// Context Utilities
// =============================================================================

/**
 * Get all enumerable properties including inherited ones (from prototype chain)
 */
function getAllKeys(obj: object): Set<string> {
    const keys = new Set<string>();
    for (const key in obj) {
        keys.add(key);
    }
    return keys;
}

/**
 * Safely get a value from context, returning undefined for missing keys
 */
function getContextValue(context: any, key: string): any {
    if (key in context) {
        return context[key];
    }
    return undefined;
}

// =============================================================================
// Expression Compilation
// =============================================================================

export function compileExpression(expression: string, context: object, raw = false): string {
    let compiled = expressionCache.get(expression);
    
    if (!compiled) {
        const variables = extractVariables(expression);
        
        try {
            // Create function with extracted variables as parameters
            const fn = new Function(...variables, `return (${expression});`);
            compiled = { fn, variables };
            expressionCache.set(expression, compiled);
        } catch (e) {
            // Syntax error in expression
            return `<!-- Expression error -->`;
        }
    }
    
    try {
        // Get values for each variable from context
        const args = compiled.variables.map(v => getContextValue(context, v));
        const result = compiled.fn(...args);
        
        if (result === undefined || result === null) return "";
        
        const stringResult = String(result);
        return raw ? stringResult : escapeHtml(stringResult);
    } catch (e) {
        // Runtime error
        return `<!-- Expression error -->`;
    }
}

/**
 * Compile expression without escaping (for raw HTML output)
 */
export function compileExpressionRaw(expression: string, context: object): string {
    return compileExpression(expression, context, true);
}

/**
 * Evaluate an expression and return the raw value (not stringified)
 * Used for props where we need actual arrays, objects, numbers, etc.
 */
export function evaluateValue(expression: string, context: object): any {
    const cacheKey = `val::${expression}`;
    let compiled = expressionCache.get(cacheKey);
    
    if (!compiled) {
        const variables = extractVariables(expression);
        
        try {
            const fn = new Function(...variables, `return (${expression});`);
            compiled = { fn, variables };
            expressionCache.set(cacheKey, compiled);
        } catch (e) {
            return undefined;
        }
    }
    
    try {
        const args = compiled.variables.map(v => getContextValue(context, v));
        return compiled.fn(...args);
    } catch (e) {
        return undefined;
    }
}

// =============================================================================
// Script Execution
// =============================================================================

/**
 * Runs a script block with the given context.
 * Scripts can read context variables directly and write via `this.property = value`.
 */
export function runScript(code: string, context: object): object {
    const cacheKey = `script::${code}`;
    let compiled = scriptCache.get(cacheKey);
    
    if (!compiled) {
        const variables = extractVariables(code);
        
        try {
            // Create function with variables as parameters
            // `this` is bound to context for writes
            const fn = new Function(...variables, `${code}; return this;`);
            compiled = { fn, variables };
            scriptCache.set(cacheKey, compiled);
        } catch (e) {
            console.error("Script compilation error:", e);
            return context;
        }
    }
    
    try {
        const args = compiled.variables.map(v => getContextValue(context, v));
        return compiled.fn.call(context, ...args);
    } catch (e) {
        console.error("Script execution error:", e);
        return context;
    }
}

// =============================================================================
// Cache Management
// =============================================================================

export function clearCaches(): void {
    expressionCache.clear();
    scriptCache.clear();
}

// =============================================================================
// Legacy Exports (for backwards compatibility during refactor)
// =============================================================================

export const compile_expression = compileExpression;
export const compile_expression_raw = compileExpressionRaw;
export const evaluate_value = evaluateValue;
export const run_script = runScript;
