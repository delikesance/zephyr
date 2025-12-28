/**
 * Path utilities
 * 
 * Path manipulation and route path utilities
 */

/**
 * Extract component name from filename
 */
export function extractComponentName(filename: string): string {
  const basename = filename.replace(/\.zph$/, '').split('/').pop() || 'Component'
  // Convert kebab-case or snake_case to PascalCase
  return basename
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}
