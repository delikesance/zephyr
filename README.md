# Zephyr.js

A JavaScript framework that compiles component-based applications to static HTML, CSS, and JavaScript.

## Overview

Zephyr.js is a framework where everything is a component. Components are defined in `.zph` files, which contain three sections:

- **Script**: TypeScript logic for the component
- **Template**: HTML markup for the component
- **Style**: Scoped CSS styles for the component

The framework compiles these components into static HTML, CSS, and JavaScript files that can be served directly by any static file server.

## Core Philosophy

- **Everything is a component**: All UI elements, pages, and features are built as reusable components
- **Compile to static**: The compiler transforms `.zph` files into plain HTML/CSS/JS for maximum performance and simplicity
- **Scoped styles**: Each component's styles are automatically scoped to prevent conflicts
- **Zero runtime overhead**: Compiled output is pure static files with no framework runtime required
- **Optimized reactivity**: Compile-time reactive system using `$()` for maximum performance
- **Nested components**: Components can import and use other components, with proper style isolation
- **Style isolation**: Parent components can optionally style child components using unscoped styles

## Design Principles

**⚠️ CRITICAL: Zero Dependencies Philosophy**

Zephyr.js follows a strict **ZERO DEPENDENCIES** policy:
- **Only Bun and TypeScript** are required - no external npm packages
- All functionality is built from scratch using Bun's built-in APIs
- This ensures minimal bundle size, fast installation, and no dependency conflicts
- The library must be production-grade and importable in real-world projects

**Production-Grade Library Goal:**
- Designed to be imported and used in production applications
- Full TypeScript support with proper type definitions
- Comprehensive error handling and validation
- Well-documented APIs
- Performance-optimized for real-world usage

## Component Structure

A `.zph` file follows this structure:

```zph
<script>
  // The script section uses TypeScript
  // $() is type-safe and returns the same type as its argument
  // Here, $(0) returns a number, so count is typed as number
  let count: number = $(0)
</script>

<template>
  <p>{{ count }}</p>
  
  <button onclick="count++">+1</button>
  <button onclick="count--">-1</button>
</template>

<style>
  button {
    background: #ff4242;
  }
</style>
```

### Component Imports

Components can import and use other components:

```zph
<import Button from "./button.zph">
<import Card from "./card.zph">

<template>
  <Card>
    <Button>Click me</Button>
  </Card>
</template>

<style>
  /* Component styles */
</style>
```

### Scoped vs Unscoped Styles

Zephyr supports two styles of CSS scoping:

**Scoped Styles** (`<style scoped>`):
- Styles are completely isolated to the component
- Cannot affect child components
- Default behavior for maximum isolation

```zph
<style scoped>
  .button { color: red; }
</style>
```

**Unscoped Styles** (`<style>`):
- Parent component can style child components
- Format: `[data-zph-parent] [data-zph-child] .selector`
- Useful for component composition and theming

```zph
<style>
  /* Parent can style child components */
  .child-button { background: blue; }
</style>
```

**Important**: Child components can never style parent components, maintaining proper encapsulation.

### Reactivity System

Zephyr.js uses an optimized reactivity system where values wrapped in `$()` become reactive:

- **TypeScript Support**: The script section uses full TypeScript syntax with type safety
- **Type-Safe Reactivity**: `$()` is a type-safe function that returns the same type as its argument. For example, `$(0)` returns `number`, so `let count: number = $(0)` is valid TypeScript
- **Reactive Declaration**: `let count: number = $(0)` marks `count` as a reactive value while maintaining type safety
- **Template Interpolation**: `{{ count }}` automatically updates when the value changes
- **Direct Manipulation**: Event handlers like `onclick="count++"` can directly modify reactive values
- **Compile-time Optimization**: The compiler generates highly optimized update code with minimal runtime overhead

#### Interpolation Syntax

**Normal Interpolation** (HTML escaped):
```zph
<template>
<p>{{ count }}</p>
<p>{{ user.name }}</p>
</template>
```

**Raw HTML** (no escaping):
```zph
<template>
<div>{{{ html }}}</div>
<!-- or -->
<div>{{@ html }}</div>
</template>
```

**Static vs Reactive**:
- Static values (known at compile time) are replaced directly in HTML
- Reactive values get update code generated for runtime changes
- Best of both worlds: optimal performance for static, reactive for dynamic

## Getting Started

### Installation

```bash
bun install
```

### Development Server

Create a `server.ts` file with fully declarative routing. Since everything must be bundleable into a single `.js` file, components are imported as modules:

```typescript
// server.ts
import { Zephyr } from 'zephyr'

// Import all page components
import Index from './pages/index.zph'
import About from './pages/about.zph'
import Contact from './pages/contact.zph'
import BlogPost from './pages/blog-post.zph'
import NotFound from './pages/404.zph'

// Create the Zephyr application
const app = new Zephyr({ 
  port: 3000 
})

// Declare all routes in a single, static configuration
// This is fully analyzable for bundling and tree-shaking
app.routes([
  { path: "/", component: Index },
  { path: "/about", component: About },
  { path: "/contact", component: Contact },
  { path: "/blog/:slug", component: BlogPost },
  { path: "*", component: NotFound } // Catch-all for 404
])

// Start the server
await app.start()

console.log(`🚀 Zephyr server running on http://localhost:3000`)
```

Run it with:

```bash
bun run server.ts
```

**Why this API?**

- **Bundleable**: All components are imported as modules, enabling static bundling into a single `.js` file
- **Fully declarative**: All routes are explicitly defined in one place, no magic
- **Type-safe**: Full TypeScript support with autocomplete and type checking
- **Tree-shakeable**: Unused routes and components can be eliminated during bundling
- **Static analysis**: Routes are statically analyzable for build-time optimizations
- **Clear structure**: All routes visible at a glance in a single array

**How it works:**

1. `.zph` files are compiled to JavaScript modules that export the compiled component
2. Components are imported like any other module
3. Routes reference the imported components directly
4. The bundler can analyze all imports and bundle everything into a single file
5. During development, the server compiles `.zph` files on-the-fly
6. For production, everything is pre-compiled and bundled

### Build

Compile all `.zph` files and bundle into a single `.js` file:

```bash
bun run build
```

This will:
1. Compile all `.zph` files to JavaScript modules
2. Bundle all routes and components into a single `.js` file
3. Generate static HTML/CSS/JS output
4. Optimize and minify the final bundle

## Project Status

This project is in early development. See [ROADMAP.md](./ROADMAP.md) for planned features and milestones.

## License

[To be determined]
