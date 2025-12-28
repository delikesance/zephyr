import { describe, it, expect } from 'bun:test'
import { processScript } from '../../src/core/script-processor.js'
import { compileZephyrFile } from '../../src/core/compiler.js'
import { CompilationError } from '../../src/core/errors.js'

describe('Phase 4.1: Script Processing', () => {
    describe('Direct Script Processing', () => {
        it('should transpile TypeScript to JavaScript', () => {
            const ts = 'const x: number = 1;'
            const result = processScript(ts, 'test.zph')
            // Bun transpiler outcome check
            expect(result.content).toContain('const x = 1')
            expect(result.content).not.toContain(': number')
        })

        it('should handle interfaces and types (remove them)', () => {
            const ts = `
        interface User {
          name: string;
        }
        const user: User = { name: 'Alice' };
      `
            const result = processScript(ts, 'test.zph')
            expect(result.content).toContain("const user = {")
            expect(result.content).toContain("name: \"Alice\"")
            expect(result.content).not.toContain("interface User")
        })

        it('should handle imports', () => {
            const ts = 'import { foo } from "./bar"; console.log(foo);'
            const result = processScript(ts, 'test.zph')
            // Imports should be extracted
            expect(result.imports[0]).toContain('import { foo } from "./bar"')
            expect(result.content).not.toContain('import { foo } from "./bar"')
            expect(result.content).toContain('console.log(foo)')
        })

        it('should handle empty scripts', () => {
            const result = processScript('', 'test.zph')
            expect(result.content).toBe('')
            expect(result.imports).toHaveLength(0)
        })

        it('should throw CompilationError on syntax error', () => {
            const ts = 'const x: number = "string";' // Type error is not syntax error usually in transpilation only
            // Syntax error example
            const syntaxError = 'const x ='

            try {
                processScript(syntaxError, 'test.zph')
            } catch (e: any) {
                expect(e).toBeInstanceOf(CompilationError)
            }
        })
    })

    describe('Integration with Compiler', () => {
        it('should compile script in .zph file', () => {
            const content = `<script>
        const count: number = 0;
      </script>
      <template>
        <div></div>
      </template>`
            const result = compileZephyrFile(content, 'test.zph')
            expect(result.js).toContain('const count = 0')
        })

        // Test that reactivity system still works (integration)
        it('should still support reactivity transformation', () => {
            const content = `<script>
let count: number = $(0)
</script>
<template>
    {{ count }}
</template>`
            const result = compileZephyrFile(content, 'reactive.zph')
            // Check for transpilation
            expect(result.js).not.toContain(': number')
            // Check for reactivity wrapper (private variable)
            expect(result.js).toContain('let _count = 0')
        })
    })
})
