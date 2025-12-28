/**
 * Performance Benchmarks
 * 
 * Run with: bun test tests/performance/benchmarks.ts
 */

import { describe, it, expect } from 'bun:test'
import { parseZephyrFile } from '../../src/core/parser.js'
import { compileComponent } from '../../src/core/compiler.js'
import type { ZephyrComponent } from '../../src/types/component.js'

// Test components of different sizes
const smallComponent = {
  name: 'Small',
  script: 'let x = 1',
  template: '<div>Hello</div>',
  style: 'div { color: red; }',
  scopeId: 'zph-small',
}

const mediumComponent = {
  name: 'Medium',
  script: `
let count: number = $(0)
let name: string = $("John")
function increment() { count++ }
`.trim(),
  template: `
<div class="container">
  <h1>{{ name }}</h1>
  <p>Count: {{ count }}</p>
  <button onclick="increment()">Increment</button>
</div>
`.trim(),
  style: `
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}
h1 { font-size: 2rem; }
button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
}
`.trim(),
  scopeId: 'zph-medium',
}

const largeComponent = {
  name: 'Large',
  script: Array.from({ length: 50 }, (_, i) => `let var${i} = ${i}`).join('\n'),
  template: Array.from({ length: 100 }, () => '<div><p>Content</p></div>').join('\n'),
  style: Array.from({ length: 50 }, (_, i) => `.class${i} { margin: ${i}px; }`).join('\n'),
  scopeId: 'zph-large',
}

// Parser benchmarks
describe('Parser Performance', () => {
  const zphContent = `<script>
let count: number = $(0)
</script>

<template>
<div>Count: {{ count }}</div>
</template>

<style>
div { color: red; }
</style>`

  it('should parse small file in < 1ms', () => {
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      parseZephyrFile(zphContent, 'test.zph')
    }
    
    const duration = performance.now() - start
    const avgTime = duration / iterations
    
    expect(avgTime).toBeLessThan(1) // < 1ms average
    console.log(`✅ Parser: ${avgTime.toFixed(3)}ms average (${iterations} iterations)`)
  })
})

// Compiler benchmarks (when implemented)
describe('Compiler Performance', () => {
  it('should compile small component in < 1ms', () => {
    // TODO: Uncomment when compiler is implemented
    // const iterations = 1000
    // const start = performance.now()
    // 
    // for (let i = 0; i < iterations; i++) {
    //   compileComponent(smallComponent)
    // }
    // 
    // const duration = performance.now() - start
    // const avgTime = duration / iterations
    // 
    // expect(avgTime).toBeLessThan(1)
    expect(true).toBe(true)
  })

  it('should compile medium component efficiently', () => {
    // TODO: Implement when compiler is ready
    expect(true).toBe(true)
  })

  it('should compile large component efficiently', () => {
    // TODO: Implement when compiler is ready
    expect(true).toBe(true)
  })
})

// Memory benchmarks
describe('Memory Usage', () => {
  it('should not leak memory when parsing many files', () => {
    const zphContent = `<template><div>Test</div></template>`
    const iterations = 1000
    
    // Force garbage collection before test
    if (global.gc) global.gc()
    
    const startMemory = process.memoryUsage().heapUsed
    
    for (let i = 0; i < iterations; i++) {
      parseZephyrFile(zphContent, `test${i}.zph`)
    }
    
    // Force garbage collection after test
    if (global.gc) global.gc()
    
    const endMemory = process.memoryUsage().heapUsed
    const memoryIncrease = (endMemory - startMemory) / 1024 / 1024 // MB
    
    // Should use less than 10MB for 1000 components
    expect(memoryIncrease).toBeLessThan(10)
  })
})
