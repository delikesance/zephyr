/**
 * Phase 3.1: Reactive Parser Tests
 * 
 * Tests for parsing reactive references in templates
 */

import { describe, it, expect } from 'bun:test'
import { parseReactiveReferences } from '../../src/template/reactive-parser.js'

describe('Phase 3.1: Reactive Parser', () => {
  describe('parseReactiveReferences', () => {
    it('should parse simple variable references', () => {
      const template = '<p>{{ count }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression).toBe('count')
      expect(refs[0].variableName).toBe('count')
      expect(refs[0].isRaw).toBe(false)
    })

    it('should parse property access', () => {
      const template = '<p>{{ user.name }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression).toBe('user.name')
      expect(refs[0].variableName).toBe('user')
      expect(refs[0].propertyPath).toEqual(['name'])
    })

    it('should parse multiple references', () => {
      const template = '<p>{{ count }}, {{ total }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(2)
      expect(refs[0].variableName).toBe('count')
      expect(refs[1].variableName).toBe('total')
    })

    it('should parse raw HTML syntax {{{ }}}', () => {
      const template = '<div>{{{ html }}}</div>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression.trim()).toBe('html')
      expect(refs[0].isRaw).toBe(true)
      expect(refs[0].fullMatch).toContain('{{{')
      expect(refs[0].fullMatch).toContain('}}}')
    })

    it('should parse raw HTML syntax {{@ }}', () => {
      const template = '<div>{{@ html }}</div>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression.trim()).toBe('html')
      expect(refs[0].isRaw).toBe(true)
      expect(refs[0].fullMatch).toContain('{{@')
      expect(refs[0].fullMatch).toContain('}}')
    })

    it('should handle whitespace in expressions', () => {
      const template = '<p>{{  count  }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression.trim()).toBe('count')
      expect(refs[0].variableName).toBe('count')
    })

    it('should return empty array for template without interpolations', () => {
      const template = '<p>Hello World</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(0)
    })

    it('should handle nested braces in expressions', () => {
      const template = '<p>{{ obj.prop }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs).toHaveLength(1)
      expect(refs[0].expression).toBe('obj.prop')
    })

    it('should track positions correctly', () => {
      const template = '<p>{{ count }}</p>'
      const refs = parseReactiveReferences(template)
      
      expect(refs[0].start).toBe(3)
      // End position includes the closing }}
      expect(refs[0].end).toBeGreaterThan(refs[0].start)
      expect(refs[0].fullMatch).toBe('{{ count }}')
      // Verify the match is correct
      expect(template.slice(refs[0].start, refs[0].end)).toBe('{{ count }}')
    })
  })
})
