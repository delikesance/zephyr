/**
 * Component Event System
 * 
 * Handles event emission and listening between components
 * 
 * Syntax:
 * - emit('eventName', data) - Emit event from component
 * - @eventName="handler" - Listen to event on child component
 * 
 * Phase 4.3: Component Logic
 */

export interface EventEmission {
    /** Event name */
    name: string
    /** Position in script */
    start: number
    /** End position */
    end: number
}

export interface EventListener {
    /** Event name (without @) */
    name: string
    /** Handler expression */
    handler: string
    /** Position in template */
    start: number
    /** End position */
    end: number
}

/**
 * Find all emit() calls in script
 */
export function findEventEmissions(script: string): EventEmission[] {
    const emissions: EventEmission[] = []

    // Pattern: emit('eventName', data) or emit("eventName", data)
    const emitPattern = /emit\s*\(\s*['"](\w+)['"]/g

    let match
    while ((match = emitPattern.exec(script)) !== null) {
        emissions.push({
            name: match[1]!,
            start: match.index,
            end: match.index + match[0].length,
        })
    }

    return emissions
}

/**
 * Find all @event listeners in template
 */
export function findEventListeners(template: string): EventListener[] {
    const listeners: EventListener[] = []

    // Pattern: @eventName="handler"
    const listenerPattern = /@(\w+)\s*=\s*["']([^"']+)["']/g

    let match
    while ((match = listenerPattern.exec(template)) !== null) {
        // Skip built-in directives
        if (match[1] === 'if' || match[1] === 'else' || match[1] === 'each') {
            continue
        }

        listeners.push({
            name: match[1]!,
            handler: match[2]!,
            start: match.index,
            end: match.index + match[0].length,
        })
    }

    return listeners
}

/**
 * Generate event emitter code for a component
 */
export function generateEventEmitter(scopeId: string): string {
    return `
// Event emitter for component
function emit(eventName, data) {
  const event = new CustomEvent('zephyr:' + eventName, {
    detail: data,
    bubbles: true,
    composed: true
  });
  
  // Find component root element and dispatch
  const root = document.querySelector('[data-${scopeId}]');
  if (root) {
    root.dispatchEvent(event);
  }
}
// Make emit globally accessible for inline event handlers
window.emit = emit;`
}

/**
 * Generate event listener attachment code
 * This is added to the parent component to listen for child events
 */
export function generateEventListenerAttachment(
    childSelector: string,
    eventName: string,
    handler: string,
    scopeId: string
): string {
    return `
// Listen for event: ${eventName}
document.querySelector('${childSelector}')?.addEventListener('zephyr:${eventName}', (e) => {
  const data = e.detail;
  ${handler}
});`
}

/**
 * Process event listeners in template
 * Converts @eventName="handler" to data attributes and generates JS
 */
export function processEventListeners(
    template: string,
    scopeId: string
): { processedTemplate: string; eventCode: string } {
    const listeners = findEventListeners(template)

    if (listeners.length === 0) {
        return { processedTemplate: template, eventCode: '' }
    }

    let processedTemplate = template
    const eventCodeParts: string[] = []

    // Sort by position in reverse order
    listeners.sort((a, b) => b.start - a.start)

    for (const listener of listeners) {
        // Find the element containing this listener
        // Look backwards for opening tag
        const beforeListener = template.slice(0, listener.start)
        const lastOpenBracket = beforeListener.lastIndexOf('<')

        // Extract tag name
        const tagMatch = beforeListener.slice(lastOpenBracket).match(/<(\w+)/)
        if (!tagMatch) continue

        const tagName = tagMatch[1]!

        // Check if this is a component tag (starts with uppercase)
        const isComponent = /^[A-Z]/.test(tagName)

        if (isComponent) {
            // For component tags, events bubble up from child component root
            // Just remove the @event attribute (component will be rendered without it)
            processedTemplate =
                processedTemplate.slice(0, listener.start) +
                processedTemplate.slice(listener.end)

            // Generate event listener code that listens on parent scope
            // Child components emit events that bubble up, so we can catch them at parent level
            eventCodeParts.push(`
// Event listener: @${listener.name} on component ${tagName}
(function() {
  const parentScope = document.querySelector('[data-${scopeId}]');
  if (!parentScope) return;
  
  // Listen for events bubbling up from child components
  parentScope.addEventListener('zephyr:${listener.name}', (e) => {
    const data = e.detail;
    // Execute handler in parent component context
    try {
      if (typeof ${listener.handler} === 'function') {
        ${listener.handler}(data);
      } else {
        console.error('Event handler "${listener.handler}" is not a function');
      }
    } catch (err) {
      console.error('Event handler error:', err);
    }
  });
})();`)
        } else {
            // For regular elements, use the original approach
            // Replace @event with data-zph-event attribute
            processedTemplate =
                processedTemplate.slice(0, listener.start) +
                `data-zph-event-${listener.name}="${listener.handler}"` +
                processedTemplate.slice(listener.end)

            // Generate event listener code
            eventCodeParts.push(`
// Event listener: @${listener.name}
document.querySelectorAll('[data-${scopeId}] [data-zph-event-${listener.name}]').forEach(el => {
  el.addEventListener('zephyr:${listener.name}', (e) => {
    const data = e.detail;
    const handler = el.getAttribute('data-zph-event-${listener.name}');
    // Execute handler in component context
    try {
      eval(handler);
    } catch (err) {
      console.error('Event handler error:', err);
    }
  });
});`)
        }
    }

    return {
        processedTemplate,
        eventCode: eventCodeParts.join('\n'),
    }
}

/**
 * Check if emit() is used in script
 */
export function usesEventEmission(script: string): boolean {
    return /\bemit\s*\(/.test(script)
}
