/**
 * Zephyr server
 * 
 * Main server class for development and production
 */

import type { ZephyrOptions, Route } from '../types/server.js'
import { findRoute, extractParams } from './router.js'
import { compileZephyrFile, compileComponent } from '../core/compiler.js'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

function logDebug(msg: string) {
  writeFileSync('debug.txt', msg + '\n', { flag: 'a' })
}

console.log("!!! Zephyr Source Loaded !!!")

/**
 * Zephyr server for development and production
 */
export class Zephyr {
  private port: number
  private dev: boolean
  private _routes: Route[] = []
  private server: ReturnType<typeof Bun.serve> | null = null

  constructor(options: ZephyrOptions) {
    this.port = options.port
    this.dev = options.dev ?? true
  }

  /**
   * Register routes - accepts an array of routes
   */
  routes(routes: Route[]): void {
    this._routes = routes
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const port = this.port
    const routes = this._routes
    const dev = this.dev

    this.server = Bun.serve({
      port,
      fetch: async (req) => {
        const url = new URL(req.url)
        const path = url.pathname

        // basic route matching
        const route = findRoute(routes, path)

        if (!route) {
          return new Response('Not Found', { status: 404 })
        }

        try {
          // Extract parameters
          const params = extractParams(route.path, path)

          // Execute loader if present
          let loaderData = {}
          if (route.loader) {
            try {
              loaderData = await route.loader(params)
            } catch (error) {
              console.error(`Loader failed for route ${route.path}:`, error)
              // Continue rendering? Or 500? For now continue with empty data.
            }
          }

          const props = { ...params, ...loaderData }

          let html = ''
          let css = ''
          let js = ''

          // Handle component (either path or object)
          logDebug(`[DEBUG] Component type: ${typeof route.component}`)

          if (typeof route.component === 'string') {
            // It's a file path - read and compile
            const filePath = route.component
            logDebug(`[DEBUG] Compiling file: ${filePath}`)
            logDebug(`[DEBUG] Props: ${JSON.stringify(props, null, 2)}`)

            if (!existsSync(filePath)) {
              return new Response(`Component file not found: ${filePath}`, { status: 500 })
            }
            const content = readFileSync(filePath, 'utf-8')
            const result = compileZephyrFile(content, filePath, { dev, props })
            html = result.html
            css = result.css
            js = result.js
          } else {
            // It's an object - compile directly
            logDebug(`[DEBUG] Compiling object component`)
            logDebug(`[DEBUG] Props: ${JSON.stringify(props, null, 2)}`)

            // Note: In dev mode with objects, we might normally want to re-parse if sources changed,
            // but if we are passed an object, we assume it's static or managed elsewhere.
            const result = compileComponent(route.component, { dev, props })
            html = result.html
            css = result.css
            js = result.js
          }

          // Generate full HTML response
          // For now, simple wrapper. Later, we'll have a proper HTML shell.
          const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zephyr App</title>
  <style>${css}</style>
</head>
<body>
  ${html}
  <script type="module">
    ${js}
  </script>
</body>
</html>`

          return new Response(fullHtml, {
            headers: { 'Content-Type': 'text/html' }
          })

        } catch (err) {
          console.error(err)
          return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
        }
      }
    })

    console.log(`Zephyr server listening on http://localhost:${port}`)
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.server) {
      this.server.stop()
      this.server = null
    }
  }
}
