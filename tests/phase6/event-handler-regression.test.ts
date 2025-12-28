import { describe, it, expect } from 'bun:test'
import { compileTemplate } from '../../src/template/template.js'

describe('Event Handler Regression Test', () => {
    it('should handle event handlers when template length changes due to reactivity', () => {
        // Template with a reactive variable before the button
        // processing this will inject 'data-reactive="..."', shifting the indices
        const template = `
    <div>
      <p>{{ count }}</p>
      <button onclick="count++">Inc</button>
    </div>`

        const staticValues = new Map()
        const reactiveVars = new Set(['count'])
        const scopeId = 'scope-123'

        const result = compileTemplate(template, scopeId, staticValues, reactiveVars)

        console.log('Result HTML:', result.html)

        // Check if HTML contains function call
        expect(result.html).toContain('onclick="handle0()"')
        expect(result.html).not.toContain('conclick')

        // Check generated JS for window assignment
        expect(result.handlerJS).toContain('window.handle0 = function')

        // Check if reactive attribute was injected (causing the shift)
        expect(result.html).toContain('data-reactive=')
    })

    it('should handle event handlers when template length changes due to interpolation', () => {
        // Template with static interpolation before button
        const template = `
    <div>
      <p>{{ staticVal }}</p>
      <button onclick="foo()">Click</button>
    </div>`

        const staticValues = new Map([['staticVal', 'A very long string that definitely shifts indices']])
        const reactiveVars = new Set(['count']) // dummy
        const scopeId = 'scope-123'

        const result = compileTemplate(template, scopeId, staticValues, reactiveVars)

        expect(result.html).toContain('A very long string')
        expect(result.html).toContain('onclick="handle0()"')
        expect(result.html).not.toContain('conclick')
    })
})
