/**
 * Phase 2.2: Nested Components Tests
 * 
 * Tests for component imports, rendering, and parent-child style interaction
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs'
import { join } from 'path'
import { parseZephyrFile } from '../../src/core/parser.js'
import { compileZephyrFile } from '../../src/core/compiler.js'
import { resolveImports } from '../../src/core/import-resolver.js'
import { renderComponents, collectChildScopeIds } from '../../src/template/component-renderer.js'
import type { ResolvedImport } from '../../src/core/import-resolver.js'

// Test directory for temporary files
const TEST_DIR = join(process.cwd(), '.test-components')

describe('Phase 2.2: Nested Components', () => {
  beforeAll(() => {
    // Create test directory
    try {
      mkdirSync(TEST_DIR, { recursive: true })
    } catch (e) {
      // Directory might already exist
    }
  })

  afterAll(() => {
    // Clean up test directory
    try {
      rmdirSync(TEST_DIR, { recursive: true })
    } catch (e) {
      // Ignore cleanup errors
    }
  })

  describe('Component Import Resolution', () => {
    it('should resolve component imports', () => {
      // Create child component file
      const childContent = `<template>
<div class="child">Child Content</div>
</template>

<style scoped>
.child { color: blue; }
</style>`

      const childPath = join(TEST_DIR, 'child.zph')
      writeFileSync(childPath, childContent)

      // Create parent component
      const parentContent = `<import Child from "./child.zph">
<template>
<div class="parent">
  <Child />
</div>
</template>

<style>
.parent { padding: 20px; }
</style>`

      const parent = parseZephyrFile(parentContent, join(TEST_DIR, 'parent.zph'))
      
      const resolved = resolveImports(parent, join(TEST_DIR, 'parent.zph'))
      
      expect(resolved).toHaveLength(1)
      expect(resolved[0].importName).toBe('Child')
      expect(resolved[0].component.name).toBe('Child')
      expect(resolved[0].instanceId).toContain('child-')
      
      // Cleanup
      unlinkSync(childPath)
    })

    it('should handle nested imports', () => {
      // Create grandchild
      const grandchildContent = `<template>
<div class="grandchild">Grandchild</div>
</template>`

      const grandchildPath = join(TEST_DIR, 'grandchild.zph')
      writeFileSync(grandchildPath, grandchildContent)

      // Create child with import
      const childContent = `<import Grandchild from "./grandchild.zph">
<template>
<div class="child">
  <Grandchild />
</div>
</template>`

      const childPath = join(TEST_DIR, 'child-nested.zph')
      writeFileSync(childPath, childContent)

      // Create parent
      const parentContent = `<import Child from "./child-nested.zph">
<template>
<div class="parent">
  <Child />
</div>
</template>`

      const parent = parseZephyrFile(parentContent, join(TEST_DIR, 'parent-nested.zph'))
      const resolved = resolveImports(parent, join(TEST_DIR, 'parent-nested.zph'))
      
      expect(resolved).toHaveLength(1)
      expect(resolved[0].component.name).toBe('ChildNested') // Component name from filename
      
      // Child should have its own imports resolved
      expect(resolved[0].compiled.html).toContain('grandchild')
      
      // Cleanup
      unlinkSync(grandchildPath)
      unlinkSync(childPath)
    })

    it('should detect circular dependencies', () => {
      // Create component A that imports B
      const aContent = `<import B from "./b.zph">
<template><div>A</div></template>`

      const aPath = join(TEST_DIR, 'a.zph')
      writeFileSync(aPath, aContent)

      // Create component B that imports A (circular)
      const bContent = `<import A from "./a.zph">
<template><div>B</div></template>`

      const bPath = join(TEST_DIR, 'b.zph')
      writeFileSync(bPath, bContent)

      const a = parseZephyrFile(aContent, aPath)
      
      expect(() => {
        resolveImports(a, aPath)
      }).toThrow('Circular dependency')

      // Cleanup
      unlinkSync(aPath)
      unlinkSync(bPath)
    })

    it('should handle missing import files', () => {
      const parentContent = `<import Missing from "./missing.zph">
<template><div>Parent</div></template>`

      const parent = parseZephyrFile(parentContent, join(TEST_DIR, 'parent-missing.zph'))
      
      expect(() => {
        resolveImports(parent, join(TEST_DIR, 'parent-missing.zph'))
      }).toThrow('Failed to import')
    })
  })

  describe('Component Rendering', () => {
    it('should render self-closing component tags', () => {
      const imports: ResolvedImport[] = [{
        importName: 'Button',
        instanceId: 'button-abc123',
        component: {
          name: 'Button',
          script: '',
          template: '<button class="btn">Click</button>',
          style: '',
          styleScoped: true,
          imports: [],
          scopeId: 'zph-button',
        },
        compiled: {
          html: '<button class="btn">Click</button>',
          css: '',
          js: '',
          component: {
            name: 'Button',
            script: '',
            template: '<button class="btn">Click</button>',
            style: '',
            styleScoped: true,
            imports: [],
            scopeId: 'zph-button',
          },
        },
      }]

      const template = '<div class="container"><Button /></div>'
      const rendered = renderComponents(template, imports, 'zph-parent')

      // Should contain the button HTML (may have instance attribute)
      expect(rendered).toContain('class="btn"')
      expect(rendered).toContain('Click</button>')
      expect(rendered).toMatch(/data-instance="button-abc123-\d+"/)
      expect(rendered).not.toContain('<Button />')
    })

    it('should render multiple instances with unique instance IDs', () => {
      const imports: ResolvedImport[] = [{
        importName: 'Counter',
        instanceId: 'counter-xyz',
        component: {
          name: 'Counter',
          script: '',
          template: '<div class="counter">0</div>',
          style: '',
          styleScoped: true,
          imports: [],
          scopeId: 'zph-counter',
        },
        compiled: {
          html: '<div class="counter">0</div>',
          css: '',
          js: '',
          component: {
            name: 'Counter',
            script: '',
            template: '<div class="counter">0</div>',
            style: '',
            styleScoped: true,
            imports: [],
            scopeId: 'zph-counter',
          },
        },
      }]

      const template = '<div><Counter /><Counter /></div>'
      const rendered = renderComponents(template, imports, 'zph-parent')

      // Should have two instances with different IDs
      const instanceMatches = rendered.match(/data-instance="counter-xyz-\d+"/g)
      expect(instanceMatches).toHaveLength(2)
      expect(instanceMatches![0]).not.toBe(instanceMatches![1])
    })

    it('should collect child scope IDs', () => {
      const imports: ResolvedImport[] = [{
        importName: 'Child1',
        instanceId: 'child1-abc',
        component: {
          name: 'Child1',
          script: '',
          template: '<div>Child1</div>',
          style: '',
          styleScoped: true,
          imports: [],
          scopeId: 'zph-child1',
        },
        compiled: {
          html: '<div>Child1</div>',
          css: '',
          js: '',
          component: {
            name: 'Child1',
            script: '',
            template: '<div>Child1</div>',
            style: '',
            styleScoped: true,
            imports: [],
            scopeId: 'zph-child1',
          },
        },
      }, {
        importName: 'Child2',
        instanceId: 'child2-xyz',
        component: {
          name: 'Child2',
          script: '',
          template: '<div>Child2</div>',
          style: '',
          styleScoped: true,
          imports: [],
          scopeId: 'zph-child2',
        },
        compiled: {
          html: '<div>Child2</div>',
          css: '',
          js: '',
          component: {
            name: 'Child2',
            script: '',
            template: '<div>Child2</div>',
            style: '',
            styleScoped: true,
            imports: [],
            scopeId: 'zph-child2',
          },
        },
      }]

      const childScopeIds = collectChildScopeIds(imports)
      expect(childScopeIds).toContain('zph-child1')
      expect(childScopeIds).toContain('zph-child2')
      expect(childScopeIds).toHaveLength(2)
    })
  })

  describe('Unscoped Parent Styles', () => {
    it('should allow parent to style child with unscoped styles', () => {
      // Create child component
      const childContent = `<template>
<button class="child-button">Click</button>
</template>

<style scoped>
.child-button { color: red; }
</style>`

      const childPath = join(TEST_DIR, 'child-button.zph')
      writeFileSync(childPath, childContent)

      // Create parent with unscoped styles
      const parentContent = `<import ChildButton from "./child-button.zph">
<template>
<div class="parent">
  <ChildButton />
</div>
</template>

<style>
.child-button { background: blue; }
</style>`

      const result = compileZephyrFile(parentContent, join(TEST_DIR, 'parent-button.zph'))

      // The parent's unscoped style should target child
      // Format: [data-zph-xxx] [data-zph-yyy] .child-button
      // Check that it has both parent and child scope IDs
      const fullCSS = result.css
      
      // Parent's unscoped style should be present (double-scoped)
      // Match pattern: [data-zph-xxx] [data-zph-yyy] .child-button
      const hasParentUnscopedStyle = /\[data-zph-\w+\]\s+\[data-zph-\w+\]\s+\.child-button/.test(fullCSS)
      
      // Verify parent's style is present
      expect(hasParentUnscopedStyle).toBe(true)
      expect(fullCSS).toContain('background: blue')
      
      // Also verify the child's own scoped style is present
      expect(fullCSS).toContain('color: red')

      // Cleanup
      unlinkSync(childPath)
    })

    it('should not allow parent to style child with scoped styles', () => {
      // Create child component
      const childContent = `<template>
<button class="child-button">Click</button>
</template>`

      const childPath = join(TEST_DIR, 'child-scoped.zph')
      writeFileSync(childPath, childContent)

      // Create parent with scoped styles
      const parentContent = `<import ChildButton from "./child-scoped.zph">
<template>
<div class="parent">
  <ChildButton />
</div>
</template>

<style scoped>
/* Scoped: Parent cannot style child */
.child-button { background: blue; }
</style>`

      const result = compileZephyrFile(parentContent, join(TEST_DIR, 'parent-scoped.zph'))

      // Scoped styles should only target parent scope
      // Format: [data-zph-xxx] .child-button (not targeting child)
      // Since parent has scoped styles and child has no matching elements in parent,
      // the CSS might be empty or only contain child's own styles
      // The key is that it should NOT have the double scope pattern
      if (result.css.includes('.child-button')) {
        // If it exists, it should NOT have the double scope pattern for unscoped
        expect(result.css).not.toMatch(/\[data-zph-\w+\]\s+\[data-zph-\w+\]\s+\.child-button/)
      }

      // Cleanup
      unlinkSync(childPath)
    })
  })

  describe('Full Component Compilation', () => {
    it('should compile parent with child component', () => {
      // Create child
      const childContent = `<template>
<div class="child-content">Hello from Child</div>
</template>

<style scoped>
.child-content { padding: 10px; }
</style>`

      const childPath = join(TEST_DIR, 'full-child.zph')
      writeFileSync(childPath, childContent)

      // Create parent
      const parentContent = `<import Child from "./full-child.zph">
<template>
<div class="parent-container">
  <Child />
</div>
</template>

<style>
.parent-container { margin: 20px; }
</style>`

      const result = compileZephyrFile(parentContent, join(TEST_DIR, 'full-parent.zph'))

      // Should have parent HTML
      expect(result.html).toContain('parent-container')
      
      // Should have child HTML rendered
      expect(result.html).toContain('child-content')
      expect(result.html).toContain('Hello from Child')
      
      // Should have parent CSS
      expect(result.css).toContain('parent-container')
      
      // Should have child CSS
      expect(result.css).toContain('child-content')

      // Cleanup
      unlinkSync(childPath)
    })
  })
})
