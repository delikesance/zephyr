/**
 * Phase 2.2: Unscoped Styles Tests
 * 
 * Tests for unscoped parent styles targeting child components
 */

import { describe, it, expect } from 'bun:test'
import { scopeStyles } from '../../src/style/scoper.js'

describe('Phase 2.2: Unscoped Styles', () => {
  it('should generate double-scoped selectors for unscoped parent styles', () => {
    const parentStyle = `.child-button { background: blue; }`
    const parentScopeId = 'zph-parent'
    const childScopeIds = ['zph-child']

    const result = scopeStyles(parentStyle, parentScopeId, false, childScopeIds)

    // Should have double-scoped selector: [data-zph-parent] [data-zph-child] .child-button
    expect(result).toContain('[data-zph-parent] [data-zph-child] .child-button')
    expect(result).toContain('background: blue')
  })

  it('should handle multiple child scope IDs', () => {
    const parentStyle = `.button { color: red; }`
    const parentScopeId = 'zph-parent'
    const childScopeIds = ['zph-child1', 'zph-child2']

    const result = scopeStyles(parentStyle, parentScopeId, false, childScopeIds)

    // Should generate selectors for each child
    expect(result).toContain('[data-zph-parent] [data-zph-child1] .button')
    expect(result).toContain('[data-zph-parent] [data-zph-child2] .button')
  })

  it('should use normal scoping when styleScoped is true', () => {
    const parentStyle = `.button { color: red; }`
    const parentScopeId = 'zph-parent'
    const childScopeIds = ['zph-child']

    const result = scopeStyles(parentStyle, parentScopeId, true, childScopeIds)

    // Should have single-scoped selector: [data-zph-parent] .button
    expect(result).toContain('[data-zph-parent] .button')
    expect(result).not.toContain('[data-zph-parent] [data-zph-child] .button')
  })

  it('should use normal scoping when no child scope IDs', () => {
    const parentStyle = `.button { color: red; }`
    const parentScopeId = 'zph-parent'
    const childScopeIds: string[] = []

    const result = scopeStyles(parentStyle, parentScopeId, false, childScopeIds)

    // Should have single-scoped selector: [data-zph-parent] .button
    expect(result).toContain('[data-zph-parent] .button')
    expect(result).not.toContain('[data-zph-parent] [data-zph-child] .button')
  })
})
