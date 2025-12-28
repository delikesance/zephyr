import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'
import { join } from 'path'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'

const TEMP_DIR = join(process.cwd(), 'tests/temp/imports')

describe('Phase 4.1: Nested Imports integration', () => {
    beforeAll(() => {
        if (!existsSync(TEMP_DIR)) {
            mkdirSync(TEMP_DIR, { recursive: true })
        }
    })

    afterAll(() => {
        // Cleanup handled strictly if needed, but for dev it is fine to leave
        // rmSync(TEMP_DIR, { recursive: true, force: true })
    })

    it('should handle imports in parent and child components', () => {
        const childPath = join(TEMP_DIR, 'Child.zph')
        const parentPath = join(TEMP_DIR, 'Parent.zph')

        writeFileSync(childPath, `<script>
import { foo } from './utils'
console.log(foo)
</script>
<template>Child</template>`)

        writeFileSync(parentPath, `<import Child from './Child.zph'>
<script>
import { bar } from './other'
console.log(bar)
</script>
<template>
    <Child />
</template>`)

        const result = compileZephyrFile(
            `<import Child from './Child.zph'>
<script>
import { bar } from './other'
console.log(bar)
</script>
<template>
    <Child />
</template>`,
            parentPath // Use parent path for resolving imports
        )

        const js = result.js
        console.log('Compiled JS:', js)

        // Check if imports are present
        expect(js).toContain('import { foo } from "./utils"')
        expect(js).toContain('import { bar } from "./other"')

        // Basic check: if import is not at start of line (excluding whitespace), it might be invalid in some contexts
        // But more importantly, if we have:
        // code
        // import
        // It is invalid.

        // Find indices
        const invalidImportIdx = js.match(/[^\n]\s*import\s+{/)
        // This regex is too simple, but let's just see where they are.

        const firstImport = js.indexOf("import { bar }")
        const secondImport = js.indexOf("import { foo }")

        // Child is appended AFTER Parent currently in compiler.ts
        // So Child's import (foo) should be AFTER Parent's code (console.log(bar))

        const parentCode = js.indexOf("console.log(bar)")

        // If foo import is after parent code, valid module parsers will fail
        // because imports must be top-level static.

        // We expect this to fail currently if we want valid ESM output.
        // But let's confirm the behavior first.
        expect(secondImport).toBeLessThan(parentCode)
    })
})
