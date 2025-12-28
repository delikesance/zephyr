/**
 * Phase 3.2: Reactivity System Tests
 * 
 * Tests for compile-time wrapper functions and automatic DOM updates
 */

import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'

describe('Phase 3.2: Reactivity System', () => {
  describe('Wrapper Functions', () => {
    it('should generate wrapper functions for reactive variables', () => {
      const content = `<script>
let count: number = $(0)
</script>

<template>
<p>{{ count }}</p>
</template>`

      const result = compileZephyrFile(content, 'test.zph')
      
      // Should have private variable
      expect(result.js).toContain('let _count = 0')
      
      // Should have wrapper function
      expect(result.js).toContain('function count(value)')
      
      // Should have DOM update function
      expect(result.js).toContain('function updateCountDOM')
    })

    it('should handle object reactive variables', () => {
      const content = `<script>
let rectangle = $({x: 0, y: 0})
</script>

<template>
<p>{{ rectangle.x }}</p>
</template>`

      const result = compileZephyrFile(content, 'test.zph')
      
      // Should have private variable
      expect(result.js).toContain('let _rectangle =')
      
      // Should have wrapper function
      expect(result.js).toContain('function rectangle(value)')
      
      // Should have DOM update function
      expect(result.js).toContain('function updateRectangleDOM')
    })

    it('should track property access for objects', () => {
      const content = `<script>
let user = $({name: "John", profile: {age: 30}})
</script>

<template>
<p>{{ user.name }}</p>
<p>{{ user.profile.age }}</p>
</template>`

      const result = compileZephyrFile(content, 'test.zph')
      
      // Should have wrapper and update functions
      expect(result.js).toContain('function user(value)')
      expect(result.js).toContain('function updateUserDOM')
    })
  })
})
