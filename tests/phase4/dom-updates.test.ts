import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'

describe('Phase 4.2: Runtime Transformation & Targeting', () => {
    it('should inject data-reactive attribute with variable name', () => {
        const code = `
      <script>
        let count = $(0)
      </script>
      <template>
        <p>{{ count }}</p>
      </template>
    `
        const result = compileZephyrFile(code, 'test.zph')

        // Check generated HTML for data-reactive="count:..."
        // Note: elementId counter is globalish per file/compile? Or reset?
        // It's per compileTemplate call.
        expect(result.html).toMatch(/data-reactive="count:\d+"/)
    })

    // We can't easily test the actual browser DOM update in this unit test
    // but verification of the attribute matching the selector is enough.

    it('should generate update function that matches the selector', () => {
        const code = `
      <script>let count = $(0)</script>
      <template><p>{{ count }}</p></template>
    `
        const result = compileZephyrFile(code, 'test.zph')

        // Check JS has updateCountDOM
        expect(result.js).toContain('function updateCountDOM(value)')
        // Check it queries for data-reactive*="count"
        expect(result.js).toContain('querySelectorAll')
        expect(result.js).toContain('data-reactive*="count"')
    })
})
