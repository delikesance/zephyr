
import { describe, it, expect } from 'bun:test'
import { compileZephyrFile } from '../../src/core/compiler'

describe('Parameter Injection (Props)', () => {
    it('should inject props into static rendering (SSR)', () => {
        const content = `
<script>
  let slug = $("default-slug")
</script>
<template>
  <h1>Post: {{ slug }}</h1>
</template>
`
        const result = compileZephyrFile(content, 'test.zph', {
            props: { slug: 'injected-slug' }
        })

        // SSR should reflect the injected prop
        // Note: Reactive values are wrapped in spans
        expect(result.html).toContain('injected-slug')
        expect(result.html).not.toContain('default-slug')
    })

    it('should generate correct initial value in JS', () => {
        const content = `
<script>
  let id = $("0")
</script>
<template>
  <div>ID: {{ id }}</div>
</template>
`
        const result = compileZephyrFile(content, 'test.zph', {
            props: { id: '123' }
        })

        // JS should have the injected value as the initial value
        // The compilation process uses the static value (123) to generate the initial variable declaration
        expect(result.js).toContain('let _id = "123"')
    })

    it('should handle complex prop types', () => {
        const content = `
<script>
  let user = $({ name: "Default" })
</script>
<template>
  <div>{{ user.name }}</div>
</template>
`
        const userProp = { name: "Injected User" }
        const result = compileZephyrFile(content, 'test.zph', {
            props: { user: userProp }
        })

        // SSR
        expect(result.html).toContain('Injected User')

        // Runtime (initial value)
        // Match key-value pair regardless of whitespace or quoting
        expect(result.js).toContain('name: "Injected User"')
    })
})
