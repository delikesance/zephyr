/**
 * Zephyr.js - A component-based framework that compiles to static HTML/CSS/JS
 * 
 * Zero dependencies - only requires Bun and TypeScript
 * 
 * @module zephyr-js
 */

// Core functionality
export { parseZephyrFile } from './core/parser.js'
export { compileComponent, compileZephyrFile } from './core/compiler.js'
export { extractStaticValues } from './core/static-values.js'
export { CompilationError, WarningCollector, formatError } from './core/errors.js'
export type { CompileError } from './core/errors.js'

// Utilities
export { minifyHTML, minifyCSS, minifyJS, minifyOutput } from './utils/minify.js'
export { ScopeIdCollisionDetector } from './utils/collision-detector.js'
export { clearSelectorCache } from './style/scoper.js'

// Server
export { Zephyr } from './server/server.js'

// Types
export type {
  ZephyrComponent,
  CompileOptions,
  CompileResult,
  Route,
  ZephyrOptions,
} from './types/index.js'
