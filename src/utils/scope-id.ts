/**
 * Scope ID generation
 * 
 * Generates unique scope IDs for components
 */

/**
 * Generates a unique scope ID for component scoping
 */
export function generateScopeId(componentName: string): string {
  // Generate a hash-like identifier based on component name
  const hash = componentName
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
  return `zph-${Math.abs(hash).toString(36)}`
}
