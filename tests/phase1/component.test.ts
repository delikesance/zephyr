/**
 * Phase 1.2: Component Structure Tests
 * 
 * Tests for component data structures and metadata
 */

import { describe, it, expect } from 'bun:test'
import type { ZephyrComponent } from '../../src/types/component.js'

describe('Phase 1.2: Component Structure', () => {
  describe('ZephyrComponent interface', () => {
    it('should have all required properties', () => {
      const component: ZephyrComponent = {
        name: 'TestComponent',
        script: 'let x = 1',
        template: '<div>Test</div>',
        style: 'div { color: red; }',
        scopeId: 'zph-test',
      }

      expect(component.name).toBe('TestComponent')
      expect(component.script).toBe('let x = 1')
      expect(component.template).toBe('<div>Test</div>')
      expect(component.style).toBe('div { color: red; }')
      expect(component.scopeId).toBe('zph-test')
    })

    it('should allow empty script', () => {
      const component: ZephyrComponent = {
        name: 'NoScript',
        script: '',
        template: '<div>Test</div>',
        style: '',
        scopeId: 'zph-noscript',
      }

      expect(component.script).toBe('')
    })

    it('should allow empty style', () => {
      const component: ZephyrComponent = {
        name: 'NoStyle',
        script: 'let x = 1',
        template: '<div>Test</div>',
        style: '',
        scopeId: 'zph-nostyle',
      }

      expect(component.style).toBe('')
    })

    it('should have scopeId in correct format', () => {
      const component: ZephyrComponent = {
        name: 'Scoped',
        script: '',
        template: '<div>Test</div>',
        style: '',
        scopeId: 'zph-abc123',
      }

      expect(component.scopeId).toMatch(/^zph-[a-z0-9]+$/)
    })
  })
})
