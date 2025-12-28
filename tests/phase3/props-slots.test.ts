/**
 * Phase 3.2: Component Props and Slots Tests
 * 
 * Tests for props passing and slot content projection
 */

import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler.js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

describe('Phase 3.2: Component Props and Slots', () => {
  const testDir = join(process.cwd(), 'tests', 'temp')
  
  // Setup: Create temp directory
  try {
    mkdirSync(testDir, { recursive: true })
  } catch {
    // Directory might already exist
  }

  describe('Props', () => {
    it('should pass props as attributes to child components', () => {
      // Create child component
      const childContent = `<script>
let message = $("Default")
</script>

<template>
<div class="child">{{ label }}</div>
</template>

<style>
.child { color: blue; }
</style>`

      writeFileSync(join(testDir, 'child.zph'), childContent)

      // Create parent component
      const parentContent = `<import Child from "./tests/temp/child.zph">

<template>
<Child label="Hello World" />
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      // Should replace {{ label }} with prop value
      expect(result.html).toContain('Hello World')
      expect(result.html).not.toContain('{{ label }}')
    })

    it('should handle multiple props', () => {
      // Create child component
      const childContent = `<template>
<div>
  <span class="title">{{ title }}</span>
  <span class="subtitle">{{ subtitle }}</span>
</div>
</template>`

      writeFileSync(join(testDir, 'multi-props.zph'), childContent)

      // Create parent component
      const parentContent = `<import MultiProps from "./tests/temp/multi-props.zph">

<template>
<MultiProps title="Main Title" subtitle="Sub Title" />
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      expect(result.html).toContain('Main Title')
      expect(result.html).toContain('Sub Title')
    })

    it('should handle props with props. prefix', () => {
      // Create child component
      const childContent = `<template>
<div>{{ props.label }}</div>
</template>`

      writeFileSync(join(testDir, 'props-prefix.zph'), childContent)

      // Create parent component
      const parentContent = `<import PropsPrefix from "./tests/temp/props-prefix.zph">

<template>
<PropsPrefix label="With Prefix" />
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      expect(result.html).toContain('With Prefix')
      expect(result.html).not.toContain('{{ props.label }}')
    })
  })

  describe('Slots', () => {
    it('should project slot content into child components', () => {
      // Create child component with slot
      const childContent = `<template>
<div class="card">
  <slot></slot>
</div>
</template>

<style>
.card { border: 1px solid black; }
</style>`

      writeFileSync(join(testDir, 'card.zph'), childContent)

      // Create parent component with slot content
      const parentContent = `<import Card from "./tests/temp/card.zph">

<template>
<Card>
  <h1>Card Title</h1>
  <p>Card content</p>
</Card>
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      // Slot should be replaced with content
      expect(result.html).toContain('Card Title')
      expect(result.html).toContain('Card content')
      expect(result.html).not.toContain('<slot>')
    })

    it('should handle empty slots', () => {
      // Create child component with slot
      const childContent = `<template>
<div class="empty">
  <slot></slot>
</div>
</template>`

      writeFileSync(join(testDir, 'empty-slot.zph'), childContent)

      // Create parent component with no slot content
      const parentContent = `<import EmptySlot from "./tests/temp/empty-slot.zph">

<template>
<EmptySlot></EmptySlot>
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      // Should compile without errors
      expect(result.html).toBeTruthy()
      expect(result.html).not.toContain('<slot>')
    })

    it('should handle self-closing slot tags', () => {
      // Create child component with self-closing slot
      const childContent = `<template>
<div>
  <slot/>
</div>
</template>`

      writeFileSync(join(testDir, 'self-closing-slot.zph'), childContent)

      // Create parent component
      const parentContent = `<import SelfClosingSlot from "./tests/temp/self-closing-slot.zph">

<template>
<SelfClosingSlot>
  <p>Content</p>
</SelfClosingSlot>
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      expect(result.html).toContain('Content')
      expect(result.html).not.toContain('<slot')
    })
  })

  describe('Props and Slots Together', () => {
    it('should handle both props and slots in same component', () => {
      // Create child component
      const childContent = `<template>
<div class="component">
  <h2>{{ title }}</h2>
  <slot></slot>
</div>
</template>`

      writeFileSync(join(testDir, 'props-and-slots.zph'), childContent)

      // Create parent component
      const parentContent = `<import PropsAndSlots from "./tests/temp/props-and-slots.zph">

<template>
<PropsAndSlots title="My Title">
  <p>Slot content here</p>
</PropsAndSlots>
</template>`

      const result = compileZephyrFile(parentContent, 'parent.zph')
      
      // Both props and slots should work
      expect(result.html).toContain('My Title')
      expect(result.html).toContain('Slot content here')
    })
  })
})
