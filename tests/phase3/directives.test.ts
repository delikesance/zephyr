/**
 * Phase 3.2: Template Directives Tests
 * 
 * Tests for @if, @else, and @each directives
 */

import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'

describe('Phase 3.2: Template Directives', () => {
  describe('Conditional Rendering (@if/@else)', () => {
    it('should compile @if directive', () => {
      const content = `<script>
let show: boolean = $(true)
</script>

<template>
<div @if="show">Visible</div>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have conditional rendering function
      expect(result.js).toContain('function renderConditional')

      // Should have display logic
      expect(result.js).toContain('style.display')

      // Template should not have @if attribute
      expect(result.html).not.toContain('@if=')
    })

    it('should compile @if with @else', () => {
      const content = `<script>
let show: boolean = $(true)
</script>

<template>
<div @if="show">Visible</div>
<div @else>Hidden</div>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have conditional rendering function
      expect(result.js).toContain('function renderConditional')

      // Should handle both if and else
      expect(result.js).toContain('ifElement')
      expect(result.js).toContain('elseElement')
    })
  })

  describe('Loops (@each)', () => {
    it('should compile @each directive', () => {
      const content = `<script>
let items = $([{id: 1, name: "Item 1"}])
</script>

<template>
<ul>
<li @each="item in items">{{ item.name }}</li>
</ul>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have loop rendering function
      expect(result.js).toContain('function renderLoop')

      // Should have forEach logic
      expect(result.js).toContain('forEach')

      // Template should not have @each attribute
      expect(result.html).not.toContain('@each=')
    })

    it('should handle @each with index', () => {
      const content = `<script>
let items = $([{id: 1, name: "Item 1"}])
</script>

<template>
<ul>
<li @each="(item, index) in items">{{ index }}: {{ item.name }}</li>
</ul>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have loop rendering function
      expect(result.js).toContain('function renderLoop')

      // Should handle index parameter
      expect(result.js).toContain('forEach')
    })
  })
})
