/**
 * Compilation-related type definitions
 */

import type { ZephyrComponent } from './component.js'

/**
 * Options for compiling components
 */
export interface CompileOptions {
  /** Output directory for compiled files */
  outDir?: string
  /** Whether to minify output (all: HTML, CSS, JS) */
  minify?: boolean
  /** Minify HTML specifically (overrides minify if set) */
  minifyHTML?: boolean
  /** Minify CSS specifically (overrides minify if set) */
  minifyCSS?: boolean
  /** Minify JS specifically (overrides minify if set) */
  minifyJS?: boolean
  /** Development mode (enables source maps, etc.) */
  dev?: boolean
  /** Props to inject into the component (e.g. route parameters) */
  props?: Record<string, any>
}

/**
 * Compilation result
 */
export interface CompileResult {
  /** Generated HTML */
  html: string
  /** Generated CSS */
  css: string
  /** Generated JavaScript */
  js: string
  /** Component metadata */
  component: ZephyrComponent
  /** Compilation warnings (if any) */
  warnings?: Array<{
    type: 'warning'
    message: string
    file?: string
    line?: number
    column?: number
    suggestion?: string
    code?: string
  }>
  /** Import statements extracted from script */
  imports?: string[]
  /** JS body without imports (for bundling) */
  jsBody?: string
}
