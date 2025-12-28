/**
 * Phase 3.2: Event Handler Compilation Tests
 * 
 * Tests for inline event handler compilation with update injection
 */

import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'

describe('Phase 3.2: Event Handler Compilation', () => {
  describe('Basic Event Handlers', () => {
    it('should compile onclick handlers', () => {
      const content = `<script>
let count: number = $(0)
</script>

<template>
<button onclick="count++">Increment</button>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have handler function
      expect(result.js).toContain('window.handle')

      // Should have update call
      expect(result.js).toContain('updateCountDOM')

      // Template should have function reference
      expect(result.html).toContain('onclick="handle')
    })

    it('should handle multiple event handlers', () => {
      const content = `<script>
let count: number = $(0)
</script>

<template>
<button onclick="count++">+</button>
<button onclick="count--">-</button>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have multiple handler functions
      const handlerMatches = result.js.match(/window\.handle\d+/g)
      expect(handlerMatches).not.toBeNull()
      expect(handlerMatches!.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle property mutations in handlers', () => {
      const content = `<script>
let rectangle = $({x: 0, y: 0})
</script>

<template>
<button onclick="rectangle.x = 10">Set X</button>
</template>`

      const result = compileZephyrFile(content, 'test.zph')

      // Should have handler function
      expect(result.js).toContain('window.handle')

      // Should have update call for rectangle
      expect(result.js).toContain('updateRectangleDOM')
    })
  })
})
