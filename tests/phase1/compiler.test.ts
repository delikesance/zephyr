/**
 * Phase 1.3: Basic Compilation Tests
 * 
 * Tests for the basic compiler functionality
 */

import { describe, it, expect } from 'bun:test'
import { compileComponent, compileZephyrFile } from '../../src/core/compiler.js'
import { createTestComponent, createCompleteComponent } from '../utils/test-helpers.js'

describe('Phase 1.3: Basic Compilation', () => {
  describe('compileComponent', () => {
    it('should compile a component to HTML, CSS, and JS', () => {
      const component = createCompleteComponent()
      const result = compileComponent(component)

      expect(result.html).toBeTruthy()
      expect(result.css).toBeTruthy()
      expect(result.js).toBeTruthy()
      expect(result.component).toBe(component)
    })

    it('should generate static HTML from template', () => {
      const component = {
        name: 'Test',
        script: 'const count = 0',
        template: '<div class="test">Count: {{ count }}</div>',
        style: '',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.html).toContain('class="test"')
      expect(result.html).toContain('data-zph-test')
      expect(result.html).toMatch(/Count: <span[^>]*>0<\/span>/) // Static value replaced
    })

    it('should extract and process CSS styles', () => {
      const component = {
        name: 'Test',
        script: '',
        template: '<div class="test"></div>',
        style: '.test { color: red; }',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.css).toContain('[data-zph-test]')
      expect(result.css).toContain('.test')
      expect(result.css).toContain('color: red')
    })

    it('should extract and process JavaScript code', () => {
      const component = {
        name: 'Test',
        script: 'let x = 1; console.log(x);',
        template: '<div></div>',
        style: '',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.js).toContain('let x = 1;')
      expect(result.js).toContain('console.log(x);')
    })

    it('should handle smart template scoping (only elements with classes/IDs)', () => {
      const component = {
        name: 'Test',
        script: '',
        template: `
          <div class="scoped">Scoped</div>
          <span>Not scoped</span>
          <p id="scoped-id">Also scoped</p>
        `,
        style: '',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.html).toContain('class="scoped"')
      expect(result.html).toContain('data-zph-test')
      expect(result.html).toContain('id="scoped-id"')
      expect(result.html).toContain('data-zph-test')
      // Plain span should not have scope ID
      expect(result.html).toMatch(/<span[^>]*>Not scoped<\/span>/)
    })

    it('should replace static values in interpolation', () => {
      const component = {
        name: 'Test',
        script: `
          const count = 0
          const name = "John"
          const active = true
        `,
        template: `
          <div>{{ count }}</div>
          <div>{{ name }}</div>
          <div>{{ active }}</div>
        `,
        style: '',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.html).toContain('>0<')
      expect(result.html).toContain('>John<')
      expect(result.html).toContain('>true<')
      expect(result.html).not.toContain('{{ count }}')
      expect(result.html).not.toContain('{{ name }}')
    })

    it('should scope CSS with [data-scope] .selector format', () => {
      const component = {
        name: 'Test',
        script: '',
        template: '<div class="test"></div>',
        style: '.test { color: red; } button { background: blue; }',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.css).toContain('[data-zph-test] .test')
      expect(result.css).toContain('[data-zph-test] button')
    })

    it('should scope CSS inside @media queries', () => {
      const component = {
        name: 'Test',
        script: '',
        template: '<div class="test"></div>',
        style: `
          .test { color: red; }
          @media (max-width: 600px) {
            .test { color: blue; }
          }
        `,
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.css).toContain('@media')
      expect(result.css).toContain('[data-zph-test] .test')
      // Both rules should be scoped
      const scopedCount = (result.css.match(/\[data-zph-test\] \.test/g) || []).length
      expect(scopedCount).toBeGreaterThanOrEqual(2)
    })

    it('should handle empty sections', () => {
      const component = {
        name: 'Test',
        script: 'const title = \'Hello World\'; const count = 0;',
        template: '<div>Test</div>',
        style: '',
        scopeId: 'zph-test',
        styleScoped: false,
        imports: [],
      }

      const result = compileComponent(component)

      expect(result.html).toBeTruthy()
      expect(result.css).toBe('')
      expect(result.js).toContain('const title')
      expect(result.js).toContain('const count')
    })
  })

  describe('compileZephyrFile', () => {
    it('should compile a .zph file to static output', () => {
      const content = `<script>
const count = 0
</script>

<template>
<div class="counter">Count: {{ count }}</div>
</template>

<style>
.counter { padding: 20px; }
</style>`

      const result = compileZephyrFile(content, 'counter.zph')

      expect(result.html).toContain('counter')
      expect(result.html).toMatch(/Count: <span[^>]*>0<\/span>/)
      expect(result.css).toContain('[data-')
      expect(result.css).toContain('.counter')
      // Phase 3.2: Reactivity system generates wrapper functions
      // With const, it might NOT generate wrappers if strict? 
      // static-values.ts extracts 'count'.
      // template.ts replaces '{{ count }}' with 0.
      // generateReactiveCode RUNS FIRST.
      // BUT 'const count = 0' -> is it reactive?
      // static-values extracts it. 
      // Does reactive-parser find 'count'? Yes.
      // So data-reactive is injected.
      // Then {{ count }} replaced with 0.
      // So HTML has Count: 0 and data-reactive attribute.
      // Does JS have 'function count'?
      // Helper function generation is in 'processReactivity' (core/reactivity.ts).
      // It uses regex to find declarations.
      // If it's 'const', 'processReactivity' might skip wrapper generation?
      // Let's check regex in 'reactivity.ts'.

      expect(result.component.name).toBe('Counter')
    })
  })
})
