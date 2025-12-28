/**
 * Server-related type definitions
 */

import type { ZephyrComponent } from './component.js'

/**
 * Route configuration
 */
export interface Route {
  /** URL path pattern */
  path: string
  /** Component to render for this route (object or path to .zph file) */
  component: ZephyrComponent | string
  /** Data loader function for this route */
  loader?: (params: Record<string, string>) => Promise<Record<string, any>> | Record<string, any>
}

/**
 * Zephyr server options
 */
export interface ZephyrOptions {
  /** Port to run the server on */
  port: number
  /** Development mode (enables hot reload, etc.) */
  dev?: boolean
}
