/**
 * Test utilities and helpers
 */

import type { ZephyrComponent } from '../../src/types/component.js'

/**
 * Creates a minimal valid Zephyr component for testing
 */
export function createTestComponent(overrides?: Partial<ZephyrComponent>): ZephyrComponent {
  return {
    name: 'TestComponent',
    script: '',
    template: '<div>Test</div>',
    style: '',
    styleScoped: true,
    imports: [],
    scopeId: 'zph-test',
    ...overrides,
  }
}

/**
 * Creates a complete test component with all sections
 */
export function createCompleteComponent(): ZephyrComponent {
  return {
    name: 'CompleteComponent',
    script: 'let count: number = $(0)',
    template: '<div>Count: {{ count }}</div>',
    style: 'div { color: red; }',
    styleScoped: true,
    imports: [],
    scopeId: 'zph-complete',
  }
}

/**
 * Sample .zph file content for testing
 */
export const SAMPLE_ZPH_CONTENT = `<script>
let count: number = $(0)
</script>

<template>
<div>Count: {{ count }}</div>
</template>

<style>
div { color: red; }
</style>`
