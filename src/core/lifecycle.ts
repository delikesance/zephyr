/**
 * Component Lifecycle Hooks
 * 
 * Processes lifecycle hook declarations and generates runtime code
 * 
 * Hooks:
 * - onMount(() => {}) - Called when component is added to DOM
 * - onDestroy(() => {}) - Called when component is removed from DOM
 * - onUpdate((changedVars) => {}) - Called when reactive state changes
 * 
 * Phase 4.3: Component Logic
 */

export interface LifecycleHook {
    /** Type of lifecycle hook */
    type: 'mount' | 'destroy' | 'update'
    /** The callback function body */
    callback: string
    /** Start position in script */
    start: number
    /** End position in script */
    end: number
}

/**
 * Find all lifecycle hook declarations in script
 */
export function findLifecycleHooks(script: string): LifecycleHook[] {
    const hooks: LifecycleHook[] = []

    // Pattern for onMount, onDestroy, onUpdate
    const hookNames = ['onMount', 'onDestroy', 'onUpdate'] as const
    const typeMap = {
        'onMount': 'mount' as const,
        'onDestroy': 'destroy' as const,
        'onUpdate': 'update' as const
    }

    for (const hookName of hookNames) {
        // Find each occurrence of the hook
        const pattern = new RegExp(hookName + '\\s*\\(', 'g')
        let match
        while ((match = pattern.exec(script)) !== null) {
            const startPos = match.index
            const openParenPos = match.index + match[0].length - 1

            // Find the matching closing parenthesis
            let parenDepth = 1
            let braceDepth = 0
            let pos = openParenPos + 1
            let openBracePos = -1
            let closeBracePos = -1

            while (pos < script.length && parenDepth > 0) {
                const char = script[pos]

                if (char === '(') parenDepth++
                else if (char === ')') parenDepth--
                else if (char === '{') {
                    if (braceDepth === 0 && openBracePos === -1) {
                        openBracePos = pos
                    }
                    braceDepth++
                }
                else if (char === '}') {
                    braceDepth--
                    if (braceDepth === 0) {
                        closeBracePos = pos
                    }
                }

                pos++
            }

            if (parenDepth === 0 && openBracePos !== -1 && closeBracePos !== -1) {
                const callback = script.slice(openBracePos + 1, closeBracePos).trim()
                const endPos = pos // pos is now right after the closing )

                hooks.push({
                    type: typeMap[hookName],
                    callback,
                    start: startPos,
                    end: endPos,
                })
            }
        }
    }

    return hooks
}

/**
 * Extract function body from script starting at opening brace
 */
function extractFunctionBody(script: string, openBracePos: number): string | null {
    if (script[openBracePos] !== '{') return null

    let depth = 1
    let pos = openBracePos + 1
    const start = pos

    while (pos < script.length && depth > 0) {
        const char = script[pos]
        if (char === '{') depth++
        else if (char === '}') depth--
        pos++
    }

    if (depth !== 0) return null

    return script.slice(start, pos - 1).trim()
}

/**
 * Process lifecycle hooks in script
 * Removes hook declarations and generates lifecycle registration code
 */
export function processLifecycleHooks(
    script: string,
    scopeId: string
): { processedScript: string; lifecycleDeclarations: string; lifecycleExecution: string } {
    const hooks = findLifecycleHooks(script)

    if (hooks.length === 0) {
        return { processedScript: script, lifecycleDeclarations: '', lifecycleExecution: '' }
    }

    // Sort hooks by position in reverse order to avoid offset issues
    hooks.sort((a, b) => b.start - a.start)

    let processedScript = script

    // Collect hooks by type
    const mountCallbacks: string[] = []
    const destroyCallbacks: string[] = []
    const updateCallbacks: string[] = []

    for (const hook of hooks) {
        // Remove the hook declaration from script
        processedScript = processedScript.slice(0, hook.start) + processedScript.slice(hook.end)

        // Store the callback
        switch (hook.type) {
            case 'mount':
                mountCallbacks.push(hook.callback)
                break
            case 'destroy':
                destroyCallbacks.push(hook.callback)
                break
            case 'update':
                updateCallbacks.push(hook.callback)
                break
        }
    }

    // Generate lifecycle code (split into declarations and execution)
    const { declarations, execution } = generateLifecycleCode(
        scopeId,
        mountCallbacks,
        destroyCallbacks,
        updateCallbacks
    )

    return { processedScript, lifecycleDeclarations: declarations, lifecycleExecution: execution }
}

/**
 * Generate lifecycle management code
 * Returns both declaration code (to be placed before reactive wrappers) and execution code (to be placed after)
 */
export function generateLifecycleCode(
    scopeId: string,
    mountCallbacks: string[],
    destroyCallbacks: string[],
    updateCallbacks: string[]
): { declarations: string; execution: string } {
    const declarationParts: string[] = []
    const executionParts: string[] = []

    // Sanitize scopeId for valid JS identifier (replace dashes with underscores)
    const safeId = scopeId.replace(/-/g, '_')

    // Mount callbacks - declarations only (execution comes later)
    if (mountCallbacks.length > 0) {
        declarationParts.push(`
// Lifecycle: onMount
const _mountCallbacks_${safeId} = [
${mountCallbacks.map(cb => `  () => { ${cb} }`).join(',\n')}
];

function _runMountCallbacks_${safeId}() {
  _mountCallbacks_${safeId}.forEach(cb => cb());
}`)
        
        // Execution code goes at the end, after all functions are declared
        executionParts.push(`
// Run mount callbacks when DOM is ready (after all functions are declared)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _runMountCallbacks_${safeId});
} else {
  _runMountCallbacks_${safeId}();
}`)
    }

    // Destroy callbacks
    if (destroyCallbacks.length > 0) {
        declarationParts.push(`
// Lifecycle: onDestroy
const _destroyCallbacks_${safeId} = [
${destroyCallbacks.map(cb => `  () => { ${cb} }`).join(',\n')}
];

function _runDestroyCallbacks_${safeId}() {
  _destroyCallbacks_${safeId}.forEach(cb => cb());
}`)
        
        // Execution code goes at the end
        executionParts.push(`
// Register for component removal
window._zephyrDestroyCallbacks = window._zephyrDestroyCallbacks || {};
window._zephyrDestroyCallbacks['${scopeId}'] = _runDestroyCallbacks_${safeId};`)
    }

    // Update callbacks - declarations only (used by reactive wrappers)
    if (updateCallbacks.length > 0) {
        declarationParts.push(`
// Lifecycle: onUpdate
const _updateCallbacks_${safeId} = [
${updateCallbacks.map(cb => `  (changedVars) => { ${cb} }`).join(',\n')}
];

function _runUpdateCallbacks_${safeId}(changedVars) {
  _updateCallbacks_${safeId}.forEach(cb => cb(changedVars));
}`)
    }

    return {
        declarations: declarationParts.join('\n'),
        execution: executionParts.join('\n')
    }
}

/**
 * Generate code to call update callbacks when reactive values change
 * This should be integrated with the reactivity system
 */
export function generateUpdateHook(scopeId: string, varName: string): string {
    return `_runUpdateCallbacks_${scopeId}?.(['${varName}']);`
}
