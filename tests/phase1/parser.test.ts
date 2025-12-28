/**
 * Phase 1.1: Parser Tests
 * 
 * Tests for the .zph file parser
 */

import { describe, it, expect } from 'bun:test'
import { parseZephyrFile } from '../../src/core/parser.js'

describe('Phase 1.1: Parser', () => {
  describe('parseZephyrFile', () => {
    it('should parse a complete .zph file with all sections', () => {
      const content = `<script>
let count: number = $(0)
</script>

<template>
<div>Count: {{ count }}</div>
</template>

<style>
div { color: red; }
</style>`

      const component = parseZephyrFile(content, 'counter.zph')

      expect(component.name).toBe('Counter')
      expect(component.scopeId).toMatch(/^zph-[a-z0-9]+$/)
      expect(component.script.trim()).toBe('let count: number = $(0)')
      expect(component.template.trim()).toContain('Count: {{ count }}')
      expect(component.style.trim()).toContain('div { color: red; }')
    })

    it('should handle missing script section', () => {
      const content = `<template>
<div>Hello</div>
</template>

<style>
div { color: blue; }
</style>`

      const component = parseZephyrFile(content, 'hello.zph')

      expect(component.script).toBe('')
      expect(component.template).toContain('Hello')
      expect(component.style).toContain('color: blue')
    })

    it('should handle missing style section', () => {
      const content = `<script>
let x = 1
</script>

<template>
<div>Test</div>
</template>`

      const component = parseZephyrFile(content, 'test.zph')

      expect(component.script).toContain('let x = 1')
      expect(component.template).toContain('Test')
      expect(component.style).toBe('')
    })

    it('should handle missing template section with warning', () => {
      const content = `<script>
let x = 1
</script>

<style>
div { color: red; }
</style>`

      // Capture console.warn
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      const component = parseZephyrFile(content, 'no-template.zph')

      expect(component.template).toBe('')
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('No <template> section found')

      console.warn = originalWarn
    })

    it('should extract component name from kebab-case filename', () => {
      const content = '<template><div>Test</div></template>'
      const component = parseZephyrFile(content, 'blog-post.zph')

      expect(component.name).toBe('BlogPost')
    })

    it('should extract component name from snake_case filename', () => {
      const content = '<template><div>Test</div></template>'
      const component = parseZephyrFile(content, 'user_profile.zph')

      expect(component.name).toBe('UserProfile')
    })

    it('should extract component name from PascalCase filename', () => {
      const content = '<template><div>Test</div></template>'
      const component = parseZephyrFile(content, 'MyComponent.zph')

      expect(component.name).toBe('Mycomponent') // First letter capitalized, rest lowercased
    })

    it('should handle tags with attributes', () => {
      const content = `<script lang="typescript">
let x = 1
</script>

<template>
<div>Test</div>
</template>

<style scoped>
div { color: red; }
</style>`

      const component = parseZephyrFile(content, 'with-attr.zph')

      expect(component.script.trim()).toBe('let x = 1')
      expect(component.template.trim()).toContain('Test')
      expect(component.style.trim()).toContain('color: red')
    })

    it('should handle case-insensitive tags', () => {
      const content = `<SCRIPT>
let x = 1
</SCRIPT>

<TEMPLATE>
<div>Test</div>
</TEMPLATE>

<STYLE>
div { color: red; }
</STYLE>`

      const component = parseZephyrFile(content, 'uppercase.zph')

      expect(component.script.trim()).toBe('let x = 1')
      expect(component.template.trim()).toContain('Test')
      expect(component.style.trim()).toContain('color: red')
    })

    it('should trim whitespace from sections', () => {
      const content = `<script>
  
  let x = 1
  
</script>

<template>
  
  <div>Test</div>
  
</template>

<style>
  
  div { color: red; }
  
</style>`

      const component = parseZephyrFile(content, 'whitespace.zph')

      expect(component.script).not.toMatch(/^\s/)
      expect(component.script).not.toMatch(/\s$/)
      expect(component.template).not.toMatch(/^\s/)
      expect(component.template).not.toMatch(/\s$/)
      expect(component.style).not.toMatch(/^\s/)
      expect(component.style).not.toMatch(/\s$/)
    })

    it('should handle empty file', () => {
      const component = parseZephyrFile('', 'empty.zph')

      expect(component.name).toBe('Empty')
      expect(component.script).toBe('')
      expect(component.template).toBe('')
      expect(component.style).toBe('')
      expect(component.scopeId).toMatch(/^zph-[a-z0-9]+$/)
    })

    it('should generate unique scope IDs for different component names', () => {
      const content = '<template><div>Test</div></template>'
      
      const component1 = parseZephyrFile(content, 'component1.zph')
      const component2 = parseZephyrFile(content, 'component2.zph')

      expect(component1.scopeId).not.toBe(component2.scopeId)
    })

    it('should generate same scope ID for same component name', () => {
      const content = '<template><div>Test</div></template>'
      
      const component1 = parseZephyrFile(content, 'counter.zph')
      const component2 = parseZephyrFile(content, 'counter.zph')

      expect(component1.scopeId).toBe(component2.scopeId)
    })

    it('should throw error for invalid content type', () => {
      expect(() => {
        parseZephyrFile(null as any, 'test.zph')
      }).toThrow('Invalid content')
    })

    it('should throw error for missing filename', () => {
      expect(() => {
        parseZephyrFile('<template></template>', '')
      }).toThrow('Filename is required')
    })

    it('should handle nested tags in content (not nested section tags)', () => {
      const content = `<script>
let html = '<div>Hello</div>'
</script>

<template>
<div>
  <p>Nested content</p>
</div>
</template>

<style>
div p { color: red; }
</style>`

      const component = parseZephyrFile(content, 'nested.zph')

      expect(component.script).toContain("let html = '<div>Hello</div>'")
      expect(component.template).toContain('<p>Nested content</p>')
      expect(component.style).toContain('div p { color: red; }')
    })

    it('should handle multiline content correctly', () => {
      const content = `<script>
function add(a: number, b: number): number {
  return a + b
}
</script>

<template>
<div>
  <h1>Title</h1>
  <p>Paragraph</p>
</div>
</template>

<style>
.counter {
  max-width: 400px;
  margin: 0 auto;
}
</style>`

      const component = parseZephyrFile(content, 'multiline.zph')

      expect(component.script).toContain('function add')
      expect(component.script).toContain('return a + b')
      expect(component.template).toContain('<h1>Title</h1>')
      expect(component.template).toContain('<p>Paragraph</p>')
      expect(component.style).toContain('max-width: 400px')
      expect(component.style).toContain('margin: 0 auto')
    })

    it('should handle real-world example from counter.zph', () => {
      const content = `<script>
	let count: number = $(0)
</script>

<template>
	<div class="counter">
		<h1>Counter Example</h1>
		<p class="count-display">Count: {{ count }}</p>
		
		<div class="buttons">
			<button onclick="count++">+1</button>
			<button onclick="count--">-1</button>
			<button onclick="count = 0">Reset</button>
		</div>
	</div>
</template>

<style>
	.counter {
		max-width: 400px;
		margin: 50px auto;
		padding: 20px;
		text-align: center;
		font-family: system-ui, sans-serif;
	}

	button {
		padding: 10px 20px;
		font-size: 1rem;
		border: none;
		border-radius: 5px;
		background: #007bff;
		color: white;
		cursor: pointer;
	}
</style>`

      const component = parseZephyrFile(content, 'counter.zph')

      expect(component.name).toBe('Counter')
      expect(component.script).toContain('let count: number = $(0)')
      expect(component.template).toContain('Counter Example')
      expect(component.template).toContain('{{ count }}')
      expect(component.template).toContain('onclick="count++"')
      expect(component.style).toContain('.counter {')
      expect(component.style).toContain('button {')
      expect(component.scopeId).toMatch(/^zph-[a-z0-9]+$/)
    })
  })
})
