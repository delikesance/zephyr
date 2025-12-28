/**
 * Router
 * 
 * Route matching and parameter extraction
 */

import type { Route } from '../types/server.js'

/**
 * Find matching route for a path
 * Supports dynamic segments like /users/:id
 */
export function findRoute(routes: Route[], path: string): Route | null {
  for (const route of routes) {
    // 1. Exact match
    if (route.path === path) {
      return route
    }

    // 2. Dynamic match
    if (route.path.includes(':')) {
      const pattern = routeToRegex(route.path)
      if (pattern.test(path)) {
        return route
      }
    }
  }

  return null
}

/**
 * Extract route parameters from path based on pattern
 * Example: pattern="/users/:id", path="/users/123" -> { id: "123" }
 */
export function extractParams(pattern: string, path: string): Record<string, string> {
  const params: Record<string, string> = {}

  const patternParts = pattern.split('/')
  const pathParts = path.split('/')

  // Basic validation length
  if (patternParts.length !== pathParts.length) {
    return params
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]

    if (patternPart && pathPart && patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1)
      params[paramName] = pathPart
    }
  }

  return params
}

/**
 * Convert route pattern to Regex
 * Private helper
 */
function routeToRegex(pattern: string): RegExp {
  // Escape special chars except colon
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Replace :param with capture group ([^/]+)
  // We match until next slash or end of string
  const regexString = '^' + escaped.replace(/:\w+/g, '([^/]+)') + '$'

  return new RegExp(regexString)
}
