import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'

describe('Phase 4.2: Runtime Transformation', () => {
    it('should transform assignments in script', () => {
        const code = `
      <script>
        let count = $(0)
        function inc() {
          count++
        }
      </script>
      <template><div></div></template>
    `
        const result = compileZephyrFile(code, 'test.zph')

        // Check if count++ became count(count() + 1)
        // Note: spaces/newlines might vary, so we check for fragments or use normalized check
        expect(result.js).toContain('count(count() + 1)')
    })

    it('should transform assignments in event handlers', () => {
        const code = `
      <script>
        let count = $(0)
      </script>
      <template>
        <button onclick="count++">Inc</button>
      </template>
    `
        const result = compileZephyrFile(code, 'test.zph')

        // Check generated event handler
        expect(result.js).toContain('window.handle0 = function')
        expect(result.js).toContain('count(count() + 1)')
    })
})
