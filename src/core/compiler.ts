/**
 * Component compiler
 * 
 * Orchestrates the compilation process, coordinating all compilation steps
 * Optimized for performance with single-pass processing
 */

import type { ZephyrComponent, CompileOptions, CompileResult } from '../types/index.js'
import { parseZephyrFile } from './parser.js'
import { extractStaticValues } from './static-values.js'
import { compileTemplate } from '../template/template.js'
import { scopeStyles } from '../style/scoper.js'
import { detectLeakage } from '../style/leakage-detector.js'
import { WarningCollector, CompilationError, formatError } from './errors.js'
import { minifyOutput } from '../utils/minify.js'
import { ScopeIdCollisionDetector } from '../utils/collision-detector.js'
import { resolveImports } from './import-resolver.js'
import { renderComponents, collectChildScopeIds } from '../template/component-renderer.js'
import { processReactivity } from './reactivity.js'
import { parseReactiveReferences } from '../template/reactive-parser.js'
import { processScript } from './script-processor.js'
import { resolve } from 'path'
import { processComputedVariables } from './computed.js'
import { processLifecycleHooks } from './lifecycle.js'
import { usesEventEmission, generateEventEmitter } from './events.js'

// Global collision detector (shared across all compilations)
const collisionDetector = new ScopeIdCollisionDetector()

/**
 * Compiles a Zephyr component to static HTML, CSS, and JavaScript
 * 
 * @param component - The component to compile
 * @param options - Compilation options
 * @param basePath - Base path for resolving imports (optional, defaults to current directory)
 * @returns Compilation result with HTML, CSS, and JS
 * @throws CompilationError if compilation fails
 */
export function compileComponent(
  component: ZephyrComponent,
  options: CompileOptions = {},
  basePath?: string
): CompileResult {
  const warnings = new WarningCollector()

  try {
    // Check for scope ID collision
    const hasCollision = collisionDetector.register(component.scopeId, component.name)
    if (hasCollision) {
      const components = collisionDetector.getComponents(component.scopeId)
      warnings.add({
        type: 'warning',
        message: `Scope ID collision detected: '${component.scopeId}' is used by multiple components`,
        file: component.name,
        suggestion: `Components with same scope ID: ${components.join(', ')}. Consider renaming one of the components.`,
      })
    }

    // Step 1: Resolve component imports (if any)
    const resolvedImports: Array<import('./import-resolver.js').ResolvedImport> = []
    if (component.imports && component.imports.length > 0) {
      const importBasePath = basePath || process.cwd()
      try {
        const imports = resolveImports(component, importBasePath, options)
        resolvedImports.push(...imports)
      } catch (error) {
        if (error instanceof CompilationError) {
          throw error
        }
        throw new CompilationError({
          type: 'error',
          message: `Failed to resolve imports: ${error instanceof Error ? error.message : String(error)}`,
          file: component.name,
        })
      }
    }

    // Step 2: Extract static values from script (for interpolation)
    const staticValues = extractStaticValues(component.script, options.props)

    // Step 2.1: Parse reactive references from template (for reactivity system)
    const reactiveReferences = component.template.trim()
      ? parseReactiveReferences(component.template)
      : []

    // Step 2.1.5: Extract lifecycle hooks BEFORE transformation (to preserve callback bodies)
    // This ensures string literals like 'count' in callbacks aren't transformed to 'count()'
    const { processedScript: scriptWithoutHooks, lifecycleDeclarations, lifecycleExecution } = processLifecycleHooks(
      component.script,
      component.scopeId
    )

    // Step 2.1.6: Check if onUpdate hooks exist (needed for wiring update callbacks)
    const hasUpdateCallbacks = /onUpdate\s*\(/.test(component.script)

    // Step 2.2: Process reactivity (generate wrapper functions)
    const { processedScript, updateFunctions } = processReactivity(
      scriptWithoutHooks,
      component.scopeId,
      staticValues,
      reactiveReferences,
      hasUpdateCallbacks
    )

    // Step 2.3: Extract reactive variable names for event handler compilation
    const reactiveVars = new Set<string>()
    const reactivePattern = /(?:let|const|var)\s+(\w+)(?:\s*:\s*[^=]+)?\s*=\s*\$\(/g
    let match
    while ((match = reactivePattern.exec(component.script)) !== null) {
      reactiveVars.add(match[1]!)
    }

    // Step 2.4: Process computed properties ($computed())
    const { processedScript: computedProcessedScript, computedCode } = processComputedVariables(
      processedScript,
      reactiveVars,
      component.scopeId
    )

    // Use the computed-processed script as final
    const lifecycleProcessedScript = computedProcessedScript

    // Use the fully processed script for template compilation
    const finalProcessedScript = lifecycleProcessedScript

    // Step 3: Compile template (smart scoping + interpolation + reactive code + event handlers + directives)
    let html = ''
    let reactiveJS = ''
    let handlerJS = ''
    let directiveJS = ''
    let eventListenerJS = ''
    let loopGlobalExports: string[] = []
    if (component.template.trim()) {
      const templateResult = compileTemplate(
        component.template,
        component.scopeId,
        staticValues,
        reactiveVars
      )
      html = templateResult.html
      reactiveJS = templateResult.reactiveJS
      handlerJS = templateResult.handlerJS
      directiveJS = templateResult.directiveJS
      eventListenerJS = templateResult.eventListenerJS
      loopGlobalExports = templateResult.loopGlobalExports

      // Step 3.1: Render component imports in template
      if (resolvedImports.length > 0) {
        html = renderComponents(html, resolvedImports, component.scopeId)
      }
    } else {
      warnings.add({
        type: 'warning',
        message: 'Template is empty',
        file: component.name,
        suggestion: 'Add a <template> section with content',
      })
    }

    // Step 4: Collect child scope IDs for unscoped parent styles
    const childScopeIds = collectChildScopeIds(resolvedImports)

    // Step 5: Detect style leakage (warnings only)
    if (component.style.trim()) {
      detectLeakage(component.style, component.scopeId, component.name, warnings)
    }

    // Step 6: Scope CSS styles (with global styles support, CSS variables, etc.)
    let css = ''
    if (component.style.trim()) {
      const scopedCSS = scopeStyles(
        component.style,
        component.scopeId,
        component.styleScoped,
        childScopeIds
      )
      css = scopedCSS
    }

    // Step 7: Collect CSS from imported components
    for (const imp of resolvedImports) {
      if (imp.compiled.css.trim()) {
        css += '\n' + imp.compiled.css
      }
    }

    // Step 8: Process script (transpile TS -> JS) and apply reactivity
    const { content: transpiledBody, imports: scriptImports } = processScript(finalProcessedScript, component.name)
    let jsBody = transpiledBody

    // Step 8.0: Add event emitter if emit() is used
    if (usesEventEmission(finalProcessedScript)) {
      jsBody += '\n' + generateEventEmitter(component.scopeId)
    }

    // Step 8.0.5: Add lifecycle hook declarations BEFORE reactive wrappers
    // This ensures _updateCallbacks is declared before reactive wrappers reference it
    if (lifecycleDeclarations.trim()) {
      jsBody += '\n' + lifecycleDeclarations
    }

    // Step 8.1: Add reactivity wrapper functions
    if (updateFunctions.length > 0) {
      jsBody += '\n' + updateFunctions.join('\n')
    }

    // Step 8.2: Add reactive update code (from template)
    if (reactiveJS.trim()) {
      jsBody += '\n' + reactiveJS
    }

    // Step 8.3: Add global exports for loop-generated event handlers (must be before loops render)
    if (loopGlobalExports.length > 0) {
      jsBody += '\n// Make functions globally accessible for inline event handlers in loops\n'
      jsBody += loopGlobalExports.join('\n')
    }

    // Step 8.4: Add event handler code
    if (handlerJS.trim()) {
      jsBody += '\n' + handlerJS
    }

    // Step 8.4.5: Add event listener code (@eventName handlers)
    // This must be after component rendering so child components exist in DOM
    if (eventListenerJS.trim()) {
      jsBody += '\n' + eventListenerJS
    }

    // Step 8.5: Add directive code (v-if, v-for)
    if (directiveJS.trim()) {
      jsBody += '\n' + directiveJS
    }

    // Step 8.5: Add computed property code
    if (computedCode.length > 0) {
      jsBody += '\n' + computedCode.join('\n')
    }

    // Step 8.6: Add lifecycle hook execution code (after all functions are declared)
    // This ensures onMount callbacks can safely call reactive wrapper functions
    if (lifecycleExecution.trim()) {
      jsBody += '\n' + lifecycleExecution
    }

    // Step 9: Collect JS from imported components
    const allImports = new Set<string>(scriptImports)

    for (const imp of resolvedImports) {
      if (imp.compiled.jsBody && imp.compiled.jsBody.trim()) {
        jsBody += '\n' + imp.compiled.jsBody
      } else if (imp.compiled.js.trim()) {
        // Fallback if jsBody not present (should generally be present)
        // But if we fallback, we might double include imports if child didn't separate them?
        // With current implementation, child ALWAYS separates them.
        jsBody += '\n' + imp.compiled.js
      }

      // Collect imports
      if (imp.compiled.imports) {
        imp.compiled.imports.forEach(i => allImports.add(i))
      }
    }

    // Construct final JS with imports at top
    let js = Array.from(allImports).join('\n')
    if (js && jsBody) js += '\n'
    js += jsBody

    // Step 10: Minify if requested
    const shouldMinify = options.minify === true
    const minifyOpts = {
      minifyHTML: options.minifyHTML ?? shouldMinify,
      minifyCSS: options.minifyCSS ?? shouldMinify,
      minifyJS: options.minifyJS ?? shouldMinify,
    }

    if (minifyOpts.minifyHTML || minifyOpts.minifyCSS || minifyOpts.minifyJS) {
      const minified = minifyOutput(html, css, js, minifyOpts)
      html = minified.html
      css = minified.css
      js = minified.js
      // Note: Minification might merge imports or mess up structure if we aren't careful.
      // minifyOutput likely uses a minifier that handles JS.
      // If we provided `js` (imports + body), it should be fine.
      // But we should update jsBody too if possible? 
      // Minifier returns single string. We can't easy update jsBody/imports after minification.
      // So if minified, jsBody and imports might be out of sync with js.
      // That's acceptable for final output.
    }

    // Step 11: Output warnings if any
    if (warnings.hasWarnings() && options.dev) {
      console.warn(formatError({
        type: 'warning',
        message: `Compilation warnings for ${component.name}`,
      }))
      console.warn(warnings.formatAll())
    }

    return {
      html,
      css,
      js,
      jsBody,
      imports: Array.from(allImports),
      component,
      warnings: warnings.hasWarnings() ? warnings.getAll() as any : undefined,
    }
  } catch (error) {
    if (error instanceof CompilationError) {
      throw error
    }

    // Wrap unexpected errors
    throw new CompilationError({
      type: 'error',
      message: `Unexpected compilation error: ${error instanceof Error ? error.message : String(error)}`,
      file: component.name,
    })
  }
}

/**
 * Compiles a .zph file from its content
 */
export function compileZephyrFile(
  content: string,
  filename: string,
  options: CompileOptions = {}
): CompileResult {
  const component = parseZephyrFile(content, filename)
  // Use filename as base path for resolving imports
  const basePath = filename
  return compileComponent(component, options, basePath)
}
