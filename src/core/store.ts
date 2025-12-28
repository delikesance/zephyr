/**
 * Store Components System
 * 
 * Handles <store> tag parsing and global state management
 * Store components create singleton state shared across all components
 * 
 * Syntax:
 * <store>
 *   let user = $({ name: '', loggedIn: false })
 *   
 *   function login(name) {
 *     user = { name, loggedIn: true }
 *   }
 * </store>
 * 
 * Phase 4.3: Component Logic
 */

export interface StoreDefinition {
    /** Store name (derived from filename) */
    name: string
    /** Store script content */
    script: string
    /** Reactive variables in the store */
    variables: string[]
    /** Functions exported from the store */
    functions: string[]
}

/**
 * Extract <store> section from .zph file content
 */
export function extractStoreSection(content: string): string | null {
    const openTagRegex = /<store([^>]*)>/i
    const closeTagRegex = /<\/store>/i

    const openMatch = content.match(openTagRegex)
    if (!openMatch) {
        return null
    }

    const openTagEnd = openMatch.index! + openMatch[0].length
    const remainingContent = content.slice(openTagEnd)

    // Find matching closing tag
    const closeMatch = remainingContent.match(closeTagRegex)
    if (!closeMatch) {
        return null
    }

    return remainingContent.slice(0, closeMatch.index).trim()
}

/**
 * Check if a .zph file is a store component
 * A store component has <store> tag instead of <template>
 */
export function isStoreComponent(content: string): boolean {
    return /<store[^>]*>/i.test(content) && !/<template[^>]*>/i.test(content)
}

/**
 * Parse store script to extract variables and functions
 */
export function parseStoreScript(script: string): { variables: string[]; functions: string[] } {
    const variables: string[] = []
    const functions: string[] = []

    // Find reactive variables: let/const varName = $(...)
    const varPattern = /(?:let|const|var)\s+(\w+)(?:\s*:\s*[^=]+)?\s*=\s*\$\(/g
    let match
    while ((match = varPattern.exec(script)) !== null) {
        variables.push(match[1]!)
    }

    // Find function declarations
    const funcPattern = /function\s+(\w+)\s*\(/g
    while ((match = funcPattern.exec(script)) !== null) {
        functions.push(match[1]!)
    }

    // Find arrow function assignments
    const arrowPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>/g
    while ((match = arrowPattern.exec(script)) !== null) {
        functions.push(match[1]!)
    }

    return { variables, functions }
}

/**
 * Compile a store component
 * Generates a singleton store that can be imported by other components
 */
export function compileStore(
    storeName: string,
    storeScript: string,
    scopeId: string
): string {
    const { variables, functions } = parseStoreScript(storeScript)

    // Process the store script similar to component script
    // but wrap it in a singleton pattern

    const parts: string[] = []

    parts.push(`
// Store: ${storeName}
// Singleton store instance
const __store_${storeName} = (() => {
  // Store state
`)

    // Add the store script (with reactive variable processing)
    parts.push(storeScript)

    // Generate the store exports
    parts.push(`
  
  // Store exports
  return {
${variables.map(v => `    get ${v}() { return ${v}(); },\n    set ${v}(val) { ${v}(val); }`).join(',\n')},
${functions.map(f => `    ${f}`).join(',\n')}
  };
})();

// Export store for use in components
window.__zephyrStores = window.__zephyrStores || {};
window.__zephyrStores['${storeName}'] = __store_${storeName};
`)

    return parts.join('')
}

/**
 * Generate store import code for a component
 * Used when a component imports a store
 */
export function generateStoreImport(storeName: string): string {
    return `const ${storeName} = window.__zephyrStores?.['${storeName}'] || {};`
}

/**
 * Generate store subscription code
 * Allows components to react to store changes
 */
export function generateStoreSubscription(
    storeName: string,
    scopeId: string,
    callback: string
): string {
    return `
// Subscribe to store: ${storeName}
window.__zephyrStoreSubscribers = window.__zephyrStoreSubscribers || {};
window.__zephyrStoreSubscribers['${storeName}'] = window.__zephyrStoreSubscribers['${storeName}'] || [];
window.__zephyrStoreSubscribers['${storeName}'].push(() => {
  ${callback}
});`
}
