/**
 * Phase 4.3: Component Logic Tests
 * 
 * Tests for computed properties, lifecycle hooks, stores, and events
 */

import { describe, it, expect } from 'bun:test'
import { findComputedVariables, processComputedVariables, inferDependencies } from '../../src/core/computed.js'
import { findLifecycleHooks, processLifecycleHooks } from '../../src/core/lifecycle.js'
import { extractStoreSection, isStoreComponent, parseStoreScript } from '../../src/core/store.js'
import { findEventEmissions, findEventListeners, usesEventEmission } from '../../src/core/events.js'
import { parseZephyrFile } from '../../src/core/parser.js'

describe('Phase 4.3: Computed Properties', () => {
    it('should find $computed declarations', () => {
        const script = `
      let firstName = $('John')
      let lastName = $('Doe')
      const fullName = $computed(() => firstName() + ' ' + lastName())
    `
        const computed = findComputedVariables(script)

        expect(computed.size).toBe(1)
        expect(computed.has('fullName')).toBe(true)
    })

    it('should find $computed with explicit dependencies', () => {
        // Use simpler expression without nested parentheses
        const script = `
      const total = $computed(() => priceVal * quantityVal, [price, quantity])
    `
        const computed = findComputedVariables(script)

        expect(computed.size).toBe(1)
        const totalVar = computed.get('total')!
        expect(totalVar.hasExplicitDeps).toBe(true)
        expect(totalVar.explicitDeps).toContain('price')
        expect(totalVar.explicitDeps).toContain('quantity')
    })

    it('should infer dependencies from expression', () => {
        const expression = 'firstName() + " " + lastName()'
        const reactiveVars = new Set(['firstName', 'lastName', 'age'])

        const deps = inferDependencies(expression, reactiveVars)

        expect(deps).toContain('firstName')
        expect(deps).toContain('lastName')
        expect(deps).not.toContain('age')
    })

    it('should process computed variables into getter functions', () => {
        const script = `const fullName = $computed(() => firstName() + lastName())`
        const reactiveVars = new Set(['firstName', 'lastName'])

        const result = processComputedVariables(script, reactiveVars, 'zph-test')

        // Should have: 1 getter function + 1 invalidation wiring
        expect(result.computedCode.length).toBe(2)
        expect(result.computedCode[0]).toContain('function fullName()')
        expect(result.computedCode[0]).toContain('_fullName_cached')
        expect(result.computedCode[1]).toContain('Wire up computed invalidation')
    })
})

describe('Phase 4.3: Lifecycle Hooks', () => {
    it('should find onMount hooks', () => {
        const script = `
      onMount(() => {
        console.log('mounted!')
      })
    `
        const hooks = findLifecycleHooks(script)

        expect(hooks.length).toBe(1)
        expect(hooks[0].type).toBe('mount')
        expect(hooks[0].callback).toContain("console.log('mounted!')")
    })

    it('should find onDestroy hooks', () => {
        const script = `
      onDestroy(() => {
        cleanup()
      })
    `
        const hooks = findLifecycleHooks(script)

        expect(hooks.length).toBe(1)
        expect(hooks[0].type).toBe('destroy')
    })

    it('should find onUpdate hooks', () => {
        const script = `
      onUpdate((changed) => {
        console.log(changed)
      })
    `
        const hooks = findLifecycleHooks(script)

        expect(hooks.length).toBe(1)
        expect(hooks[0].type).toBe('update')
    })

    it('should generate lifecycle code', () => {
        const script = `
      onMount(() => {
        console.log('ready')
      })
    `
        const result = processLifecycleHooks(script, 'zph-test')

        expect(result.lifecycleCode).toContain('_mountCallbacks')
        expect(result.lifecycleCode).toContain('DOMContentLoaded')
    })
})

describe('Phase 4.3: Store Components', () => {
    it('should extract <store> section', () => {
        const content = `
      <store>
        let user = $({ name: '' })
      </store>
    `
        const store = extractStoreSection(content)

        expect(store).not.toBeNull()
        expect(store).toContain('let user')
    })

    it('should detect store components', () => {
        const storeContent = `
      <store>
        let count = $(0)
      </store>
    `
        const componentContent = `
      <template>
        <div>Hello</div>
      </template>
    `

        expect(isStoreComponent(storeContent)).toBe(true)
        expect(isStoreComponent(componentContent)).toBe(false)
    })

    it('should parse store script for variables and functions', () => {
        const script = `
      let user = $({ name: '' })
      let count = $(0)
      
      function login(name) {
        user = { name }
      }
      
      const logout = () => {
        user = { name: '' }
      }
    `
        const result = parseStoreScript(script)

        expect(result.variables).toContain('user')
        expect(result.variables).toContain('count')
        expect(result.functions).toContain('login')
    })

    it('should parse store components with parser', () => {
        const content = `
      <store>
        let user = $({ name: '' })
      </store>
    `
        const component = parseZephyrFile(content, 'user-store.zph')

        expect(component.isStore).toBe(true)
        expect(component.store).toContain('let user')
        expect(component.template).toBe('')
    })
})

describe('Phase 4.3: Event System', () => {
    it('should find emit() calls', () => {
        const script = `
      function handleClick() {
        emit('select', { id: 1 })
      }
    `
        const emissions = findEventEmissions(script)

        expect(emissions.length).toBe(1)
        expect(emissions[0].name).toBe('select')
    })

    it('should find @event listeners', () => {
        const template = `
      <ChildComponent @select="handleSelect" @update="handleUpdate" />
    `
        const listeners = findEventListeners(template)

        expect(listeners.length).toBe(2)
        expect(listeners[0].name).toBe('select')
        expect(listeners[0].handler).toBe('handleSelect')
        expect(listeners[1].name).toBe('update')
    })

    it('should not treat directives as event listeners', () => {
        const template = `
      <div @if="show">
        <span @each="item in items">{{ item }}</span>
      </div>
    `
        const listeners = findEventListeners(template)

        expect(listeners.length).toBe(0)
    })

    it('should detect emit usage', () => {
        expect(usesEventEmission('emit("test")')).toBe(true)
        expect(usesEventEmission("emit('click')")).toBe(true)
        expect(usesEventEmission('console.log("hello")')).toBe(false)
    })
})
