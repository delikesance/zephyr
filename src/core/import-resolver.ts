/**
 * Component import resolver
 * 
 * Resolves component imports, handles circular dependencies, and generates instance IDs
 */

import { readFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { parseZephyrFile } from './parser.js'
import { compileComponent } from './compiler.js'
import type { ZephyrComponent, CompileOptions, CompileResult } from '../types/index.js'
import { CompilationError } from './errors.js'

/**
 * Resolved import with compiled component and instance ID
 */
export interface ResolvedImport {
  /** The imported component */
  component: ZephyrComponent
  /** Compiled result of the imported component */
  compiled: CompileResult
  /** Unique instance ID for this usage */
  instanceId: string
  /** Import name (as used in template) */
  importName: string
}

/**
 * Resolve component imports
 * 
 * @param component - The component with imports
 * @param basePath - Base path for resolving relative imports
 * @param options - Compilation options
 * @param visited - Set of already visited files (for circular dependency detection)
 * @returns Array of resolved imports
 */
export function resolveImports(
  component: ZephyrComponent,
  basePath: string,
  options: CompileOptions = {},
  visited: Set<string> = new Set()
): ResolvedImport[] {
  if (component.imports.length === 0) {
    return []
  }

  const resolved: ResolvedImport[] = []
  const componentDir = dirname(basePath)

  for (const imp of component.imports) {
    try {
      // Resolve import path (relative to component file)
      const importPath = resolve(componentDir, imp.path)
      
      // Check for circular dependencies
      const normalizedPath = normalizePath(importPath)
      if (visited.has(normalizedPath)) {
        throw new CompilationError({
          type: 'error',
          message: `Circular dependency detected: ${imp.name} from ${imp.path}`,
          file: component.name,
          suggestion: 'Remove the circular dependency by restructuring your components',
        })
      }

      // Read and parse imported component
      const content = readFileSync(importPath, 'utf-8')
      const importedComponent = parseZephyrFile(content, importPath)

      // Recursively resolve imports of imported component
      // Pass the importPath as basePath so nested imports resolve correctly
      const newVisited = new Set(visited)
      newVisited.add(normalizedPath)
      const nestedImports = resolveImports(importedComponent, importPath, options, newVisited)

      // Compile the imported component
      // Pass importPath as basePath so nested imports in the compiled component resolve correctly
      const compiled = compileComponent(importedComponent, options, importPath)

      // Generate unique instance ID for this usage
      // Format: {componentName}-{hash} to ensure uniqueness
      const instanceId = generateInstanceId(imp.name, component.scopeId)

      resolved.push({
        component: importedComponent,
        compiled,
        instanceId,
        importName: imp.name,
      })
    } catch (error) {
      if (error instanceof CompilationError) {
        throw error
      }
      
      // Handle file not found or other errors
      throw new CompilationError({
        type: 'error',
        message: `Failed to import component '${imp.name}' from '${imp.path}': ${error instanceof Error ? error.message : String(error)}`,
        file: component.name,
        suggestion: `Check that the file exists at the specified path: ${resolve(componentDir, imp.path)}`,
      })
    }
  }

  return resolved
}

/**
 * Normalize path for circular dependency detection
 */
function normalizePath(path: string): string {
  return resolve(path).replace(/\\/g, '/')
}

/**
 * Generate unique instance ID for a component usage
 * Format: {componentName}-{hash}
 * 
 * Note: Instance IDs are generated per import declaration, not per usage.
 * Multiple usages of the same import will share the same instance ID.
 * For per-usage instance IDs, we'd need to track usage position in template.
 */
function generateInstanceId(componentName: string, parentScopeId: string): string {
  // Use a simple hash based on component name and parent scope
  // This ensures uniqueness while being deterministic
  // For now, each import gets one instance ID (shared across multiple usages)
  const hash = simpleHash(`${componentName}-${parentScopeId}`)
  return `${componentName.toLowerCase()}-${hash.toString(36).slice(0, 8)}`
}

/**
 * Simple hash function for instance IDs
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
