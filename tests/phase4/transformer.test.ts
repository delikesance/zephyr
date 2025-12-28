import { describe, it, expect } from 'bun:test'
import { transformReactiveCode } from '../../src/core/transformer.js'

describe('Reactivity Transformer', () => {
    it('should transform increments', () => {
        const code = 'count++'
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toBe('count(count() + 1)')
    })

    it('should transform assignments', () => {
        const code = 'count = 10'
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toBe('count(10)')
    })

    it('should transform reads', () => {
        const code = 'console.log(count)'
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toBe('console.log(count())')
    })

    it('should not transform existing calls', () => {
        const code = 'console.log(count())'
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toBe('console.log(count())')
    })

    it('should handle multiple statements', () => {
        const code = `
      count++
      count = 0
    `
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toContain('count(count() + 1)')
        expect(result).toContain('count(0)')
    })

    it('should ignore non-reactive variables', () => {
        const code = 'other++'
        const vars = new Set(['count'])
        const result = transformReactiveCode(code, vars)
        expect(result).toBe('other++')
    })
})
