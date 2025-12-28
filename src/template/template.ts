/**
 * Template compilation
 * 
 * Processes templates and generates HTML
 * Phase 3.2: Integrated event handlers, directives, and reactive updates
 */

import { smartScopeTemplate } from './smart-scope.js'
import { processInterpolation } from './interpolation.js'
import { parseReactiveReferences } from './reactive-parser.js'
import { generateReactiveCode } from './reactive-generator.js'
import { parseEventHandlers, compileEventHandlers, replaceEventHandlers } from './event-handlers.js'
import { transformReactiveCode } from '../core/transformer.js'
import { parseConditionalDirectives, parseLoopDirectives, generateConditionalCode, generateLoopCode } from './directives.js'
import { processEventListeners } from '../core/events.js'
import type { StaticValues } from '../core/static-values.js'

export interface TemplateCompileResult {
  /** Compiled HTML */
  html: string
  /** Generated reactive update code */
  reactiveJS: string
  /** Generated event handler code */
  handlerJS: string
  /** Generated directive code (v-if, v-for) */
  directiveJS: string
  /** Generated event listener code (@eventName handlers) */
  eventListenerJS: string
  /** Global exports needed for loop-generated event handlers */
  loopGlobalExports: string[]
}

/**
 * Compile template to HTML
 * 
 * @param template - The template HTML
 * @param scopeId - The scope ID for scoping
 * @param staticValues - Static values for interpolation replacement
 * @param reactiveVars - Set of reactive variable names (for event handler compilation)
 * @returns Compiled template with HTML and reactive JS
 */
export function compileTemplate(
  template: string,
  scopeId: string,
  staticValues: StaticValues,
  reactiveVars?: Set<string>
): TemplateCompileResult {
  if (!template.trim()) {
    return { html: template, reactiveJS: '', handlerJS: '', directiveJS: '', eventListenerJS: '', loopGlobalExports: [] }
  }

  // Step 0: Process event listeners (@eventName="handler") BEFORE component rendering
  // This must happen before components are rendered so we can find @eventName on component tags
  const { processedTemplate: templateWithEventAttrs, eventCode: eventListenerJS } = processEventListeners(template, scopeId)
  let processed = templateWithEventAttrs

  // Step 1: Parse reactive references
  const references = parseReactiveReferences(processed)

  // Step 2: Parse event handlers (moved to Step 6)

  // Step 3: Parse directives (v-if, v-for)
  const conditionalDirectives = parseConditionalDirectives(template)
  const loopDirectives = parseLoopDirectives(template)

  // Step 4: Generate reactive code (inject attributes)
  // We do this BEFORE interpolation so that we can find the {{ var }} references
  // and attach data attributes to their parent elements.
  const reactiveCode = generateReactiveCode(processed, references, staticValues, scopeId)
  processed = reactiveCode.template

  // Step 5: Process interpolation (replace static/initial values)
  // Replaces {{ count }} with 0 (initial value)
  processed = processInterpolation(processed, staticValues)

  // Step 6: Compile event handlers (if reactive vars provided)
  let handlerJS = ''
  if (reactiveVars) {
    // Parse handlers from the PROCESSED template (to get correct indices)
    const handlers = parseEventHandlers(processed)

    if (handlers.length > 0) {
      const handlerResult = compileEventHandlers(handlers, processed, reactiveVars, scopeId)
      handlerJS = handlerResult.handlerCode
      processed = handlerResult.modifiedTemplate
    }
  }

  // Step 7: Generate directive code (v-if, v-for)
  let directiveJS = ''
  if (conditionalDirectives.length > 0) {
    const conditionalCode = generateConditionalCode(conditionalDirectives, scopeId)
    directiveJS += conditionalCode.js

    // Replace directives in template (simplified - just remove @if/@else attributes)
    for (const directive of conditionalDirectives) {
      processed = processed.replace(/\s+@if=["'][^"']+["']/g, '')
      processed = processed.replace(/\s+@else/g, '')
    }
  }

  let loopGlobalExports: string[] = []
  if (loopDirectives.length > 0) {
    const loopCode = generateLoopCode(loopDirectives, scopeId, processed, reactiveVars)
    directiveJS += '\n' + loopCode.js
    processed = loopCode.modifiedTemplate
    loopGlobalExports = loopCode.globalExports
  }

  // Step 8: Smart scope (inject scope ID on elements with classes/IDs)
  processed = smartScopeTemplate(processed, scopeId)

  return {
    html: processed,
    reactiveJS: reactiveCode.js,
    handlerJS,
    directiveJS,
    eventListenerJS,
    loopGlobalExports,
  }
}
