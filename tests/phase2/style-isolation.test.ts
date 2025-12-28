/**
 * Phase 2.2: Style Isolation Tests
 * 
 * Tests for scoped vs unscoped styles, component imports, and leakage detection
 */

import { describe, it, expect } from 'bun:test'
import { parseZephyrFile } from '../../src/core/parser.js'
import { compileComponent } from '../../src/core/compiler.js'
import { createTestComponent } from '../utils/test-helpers.js'

describe('Phase 2.2: Style Isolation', () => {
  describe('Scoped vs Unscoped Styles', () => {
    it('should detect scoped style attribute', () => {
      const content = `<template><div>Test</div></template>
<style scoped>
div { color: red; }
</style>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.styleScoped).toBe(true)
    })

    it('should detect unscoped style (no scoped attribute)', () => {
      const content = `<template><div>Test</div></template>
<style>
div { color: red; }
</style>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.styleScoped).toBe(false)
    })

    it('should default to scoped if no style tag', () => {
      const content = `<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.styleScoped).toBe(true)
    })

    it('should scope styles normally when styleScoped is true', () => {
      const component = createTestComponent({
        style: '.button { color: red; }',
        styleScoped: true,
      })

      const result = compileComponent(component)
      expect(result.css).toContain('[data-zph-test] .button')
    })
  })

  describe('Component Imports', () => {
    it('should extract import declarations', () => {
      const content = `<import Foo from "./foo.zph">
<import Bar from './bar.zph' />
<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.imports).toHaveLength(2)
      expect(component.imports[0]).toEqual({ name: 'Foo', path: './foo.zph' })
      expect(component.imports[1]).toEqual({ name: 'Bar', path: './bar.zph' })
    })

    it('should handle imports with single quotes', () => {
      const content = `<import Component from './component.zph'>
<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.imports).toHaveLength(1)
      expect(component.imports[0].path).toBe('./component.zph')
    })

    it('should handle imports with double quotes', () => {
      const content = `<import Component from "./component.zph">
<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.imports).toHaveLength(1)
      expect(component.imports[0].path).toBe('./component.zph')
    })

    it('should handle self-closing import tags', () => {
      const content = `<import Foo from "./foo.zph" />
<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.imports).toHaveLength(1)
      expect(component.imports[0].name).toBe('Foo')
    })

    it('should return empty array if no imports', () => {
      const content = `<template><div>Test</div></template>`

      const component = parseZephyrFile(content, 'test.zph')
      expect(component.imports).toEqual([])
    })
  })

  describe('Leakage Detection', () => {
    it('should warn on global selectors without :root', () => {
      const component = createTestComponent({
        style: 'body { margin: 0; }',
      })

      const result = compileComponent(component, { dev: true })
      expect(result.warnings?.length).toBeGreaterThan(0)
      const warnings = result.warnings || []
      expect(warnings.some(w => w.message.includes('body') || w.message.includes('Global selector'))).toBe(true)
    })

    it('should warn on html selector without :root', () => {
      const component = createTestComponent({
        style: 'html { font-size: 16px; }',
      })

      const result = compileComponent(component, { dev: true })
      const warnings = result.warnings || []
      expect(warnings.some(w => w.message.includes('html') || w.message.includes('Global selector'))).toBe(true)
    })

    it('should warn on universal selector without :root', () => {
      const component = createTestComponent({
        style: '* { box-sizing: border-box; }',
      })

      const result = compileComponent(component, { dev: true })
      const warnings = result.warnings || []
      expect(warnings.some(w => w.message.includes('*') || w.message.includes('Global selector'))).toBe(true)
    })

    it('should not warn on :root styles', () => {
      const component = createTestComponent({
        style: ':root { --color: blue; }',
      })

      const result = compileComponent(component, { dev: true })
      const warnings = result.warnings || []
      // Filter out collision warnings (from test setup)
      const leakageWarnings = warnings.filter(w => w.message.includes('leakage') || w.message.includes(':root'))
      expect(leakageWarnings.some(w => w.message.includes(':root'))).toBe(false)
    })

    it('should warn on overly broad selectors', () => {
      const component = createTestComponent({
        style: 'div { color: red; }',
      })

      const result = compileComponent(component, { dev: true })
      const warnings = result.warnings || []
      expect(warnings.some(w => w.message.includes('broad'))).toBe(true)
    })

    it('should not warn on scoped selectors with classes', () => {
      const component = createTestComponent({
        style: '.container { padding: 20px; }',
      })

      const result = compileComponent(component, { dev: true })
      const warnings = result.warnings || []
      // Filter out collision warnings (from test setup)
      const leakageWarnings = warnings.filter(w => w.message.includes('leakage') || w.message.includes('broad'))
      expect(leakageWarnings.some(w => w.message.includes('broad'))).toBe(false)
    })
  })
})
