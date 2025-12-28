# Zephyr.js Roadmap

This document outlines the development plan for Zephyr.js, a component-based framework that compiles to static HTML/CSS/JS.

## ⚠️ CRITICAL DESIGN CONSTRAINTS

**Zero Dependencies Philosophy:**
- **ONLY Bun and TypeScript** are allowed as dependencies
- No external npm packages whatsoever
- All functionality must be built from scratch using Bun's built-in APIs
- This is a non-negotiable requirement for the entire project

**Production-Grade Library Goal:**
- Must be importable and usable in real-world production projects
- Full TypeScript support with comprehensive type definitions
- Robust error handling and validation throughout
- Well-documented APIs with examples
- Performance-optimized for production workloads
- Proper testing and quality assurance

**All development must adhere to these constraints.**

## Phase 1: Core Foundation 🏗️

### 1.1 Parser ✅
- [x] Create `.zph` file parser
- [x] Extract `<script>`, `<template>`, and `<style>` sections
- [x] Handle edge cases (nested tags, comments, etc.)
- [x] Component name extraction from filename

### 1.2 Component Structure ✅
- [x] Define component data structures
- [x] Component metadata and scope management
- [x] Component identification system

### 1.3 Basic Compilation ✅
- [x] Smart template scoping (elements with classes/IDs only)
- [x] Static value generation for {{ }} when known at compile time
- [x] CSS state machine parser
- [x] CSS scoping with [data-scope] .selector format
- [x] Scope @rules (@media, @keyframes, etc.)
- [x] Script pass-through with validation
- [x] Comprehensive error handling (Error vs Warning)
- [x] All optimizations (array.join, single-pass, etc.)
- [x] Handle all edge cases
- [x] Performance benchmarks (< 1ms target)

## Phase 2: Style Scoping 🎨

### 2.1 CSS Scoping ✅
- [x] Generate unique scope IDs for components
- [x] Apply scope IDs to CSS selectors
- [x] Apply scope IDs to HTML elements
- [x] Handle pseudo-selectors and media queries
- [x] Preserve global styles when needed (:root support)
- [x] Scope ID collision detection
- [x] CSS variables scoping (scope declarations)
- [x] Selector caching for performance
- [x] Handle edge cases (Unicode, escaped chars, attribute selectors)
- [x] Comprehensive tests

### 2.2 Style Isolation ✅
- [x] Ensure styles don't leak between components
- [x] Handle nested component styles
- [x] Support for CSS variables scoping
- [x] Component import system (`<import>` syntax)
- [x] Scoped vs unscoped styles (`<style scoped>` vs `<style>`)
- [x] Parent-child style interaction (unscoped parent can style child)
- [x] Leakage detection (warnings for global/broad selectors)
- [x] Multiple component instances (shared CSS, isolated state)

## Phase 3: Template Compilation 📄

### 3.1 Basic Template Features ✅
- [x] Static HTML generation
- [x] Reactive value interpolation syntax `{{ }}`
- [x] Parse and identify reactive references in templates
- [x] State machine parser for reactive references
- [x] Raw HTML syntax support (`{{{ }}}` and `{{@ }}`)
- [x] HTML escaping by default
- [x] Reactive update code generation
- [x] Data attributes for element targeting
- [x] Property access support (`user.name`)
- [x] Hybrid approach (static + reactive)
- [x] Example testing and validation
  - [x] All examples compile successfully
  - [x] Example compilation testing infrastructure
  - [x] Performance benchmarking for examples

### 3.2 Template Features
- [x] Reactive value interpolation `{{ value }}` (runtime updates)
- [x] Inline event handlers (onclick, onchange, etc.)
- [x] Event handler compilation
- [x] Direct reactive value manipulation in handlers
- [x] Runtime reactive updates for all reactive values
- [x] Property change detection and DOM updates
- [x] Object property modification in event handlers
- [x] Nested property access in templates and handlers
- [x] Conditional rendering (@if/@else)
- [x] Loops and lists (@each)
- [x] Component composition/nesting (props and slots)
- [x] Example testing and validation (comprehensive tests created)

## Phase 4: JavaScript Processing ⚡

### 4.1 Script Extraction ✅
- [x] Extract TypeScript from script sections
- [x] TypeScript compilation and type checking
- [x] Handle ES modules
- [x] Basic bundling/concatenation
- [x] Type definitions for `$()` function

### 4.2 Reactivity System ✅
- [x] Parse `$()` reactive value declarations in TypeScript
- [x] Type-safe `$()` function that preserves types (e.g., `$(0)` returns `number`)
- [x] Track reactive dependencies in templates
- [x] Generate optimized update code for reactive values
- [x] Handle reactive value mutations (++, --, =, etc.)
- [x] Support reactive object properties with type inference
- [x] Example testing and validation (ensure all examples work with reactivity)
- [x] Compile-time dependency analysis
- [x] Minimize runtime overhead through static analysis
- [x] TypeScript type checking for reactive value usage

### 4.3 Component Logic ✅
- [x] Component lifecycle hooks (`onMount`, `onDestroy`, `onUpdate`)
- [x] Event system (`emit()` and `@event`)
  - [x] Event handler name scoping (unique handler names per component using scopeId)
  - [x] Fixed handler name conflicts across components
- [x] State management
  - [x] Store Components (`<store>` tag in .zph files)
- [x] Computed properties (`$computed()`)

## Phase 5: Component Composition 🔗

### 5.1 Component Nesting
- [ ] Support for nested components
- [ ] Component imports/registration
- [ ] Props/data passing between components

### 5.2 Component Reusability
- [ ] Component library system
- [ ] Component sharing mechanism
- [ ] Component documentation

## Phase 6: Build System 🛠️

### 6.1 Development Server ✅
- [x] Zephyr server class for development
- [x] Module-based component imports (`.zph` files compile to importable modules)
- [x] Explicit, declarative route registration API with imported components
- [x] Static route configuration (fully analyzable for bundling)
- [x] On-the-fly compilation of `.zph` files in development
- [x] Hot reload/watch mode
- [x] Error handling and reporting
- [x] Development vs production modes
- [ ] Support for async route handlers (future)

### 6.2 Bundling System
- [ ] Compile `.zph` files to JavaScript modules
- [ ] Static analysis of route configuration
- [ ] Bundle all routes and components into single `.js` file
- [ ] Tree-shaking for unused components
- [ ] Code splitting support (optional)
- [ ] Module resolution and dependency tracking

### 6.3 CLI Tool ✅
- [x] Command-line interface
- [x] Watch mode for development
- [x] Build command for production (bundles to single `.js`)
- [ ] Configuration file support

### 6.4 Output Optimization
- [ ] HTML minification
- [ ] CSS minification
- [ ] JavaScript minification
- [ ] Asset optimization
- [ ] Source maps generation
- [ ] Bundle size optimization

## Phase 7: Developer Experience 🚀

### 7.1 Development Tools
- [ ] Hot module replacement (HMR)
- [ ] Error reporting and debugging
- [ ] Component preview/playground
- [ ] Development server

### 7.2 Documentation
- [ ] API documentation
- [ ] Component examples
- [ ] Best practices guide
- [ ] Migration guides

## Phase 8: Advanced Features 🌟

### 8.1 Performance
- [ ] Reactive system optimizations
  - [ ] Dead code elimination for unused reactive values
  - [ ] Batch updates for multiple reactive changes
  - [ ] Minimal DOM updates (only update changed nodes)
  - [ ] Compile-time dependency graph optimization
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Tree shaking
- [ ] Bundle size optimization

### 8.2 Features
- [ ] Server-side rendering (SSR) support
- [ ] Static site generation (SSG)
- [ ] Routing system
- [ ] Form handling
- [ ] Validation system

## Phase 9: Ecosystem 🌐

### 9.1 Tooling
- [ ] VS Code extension
- [ ] ESLint plugin
- [ ] Prettier plugin
- [ ] Testing utilities

### 9.2 Community
- [ ] Component marketplace
- [ ] Plugin system
- [ ] Community templates
- [ ] Examples and tutorials

## Example-Driven Development

All examples in `examples/` directory serve as:
- **API Specification** - Define how Zephyr.js should work
- **Test Cases** - Must compile and work correctly
- **Documentation** - Show real-world usage patterns
- **Feature Requirements** - Drive implementation priorities

### Development Workflow

**For Each Phase:**
1. Review examples to identify required features
2. Implement features to make examples work
3. Test all examples to verify implementation
4. Update examples if API evolves
5. Document feature requirements in phase checklist

### Example Testing

**Continuous Testing:**
- All examples must compile successfully (`bun run test-all-examples.ts`)
- Examples tested as part of development workflow
- Performance benchmarks tracked per example
- Examples serve as integration tests

**Current Examples:**
- `basic-counter` - Simple reactive counter
- `rectangle` - Object reactivity with properties
- `todo-list` - Full CRUD application
- `multi-page` - Multiple routes
- `blog-post` - Dynamic routes

**Status**: All examples compile successfully. Runtime functionality depends on phase completion.

## Current Focus

We have completed **Phase 4** - JavaScript Processing. The immediate priorities are:

1. Complete Phase 3: Template Compilation ✅
2. Complete Phase 4: JavaScript Processing ✅
3. Begin Phase 4.3 (Component Logic) or Phase 6 (Build System)
4. Create CLI tooling for better developer experience

## Recent Fixes & Improvements

### Event Handler Name Conflicts (Fixed)
- **Issue**: Event handlers from different components used the same function names (e.g., `handle0`), causing the second component's handlers to overwrite the first component's handlers
- **Impact**: Clicking buttons in one component would trigger handlers from another component
- **Solution**: Modified `src/template/event-handlers.ts` to include component scopeId in handler function names (e.g., `handle0_zphli1r2c`, `handle0_zphsss30v`)
- **Status**: ✅ Fixed - Handler names are now unique across all components

## Notes

- This roadmap is subject to change based on community feedback and project needs
- Some features may be implemented in parallel
- Priorities may shift as the project evolves
- Contributions and suggestions are welcome!

## Reminders

**⚠️ Always remember:**
- **ZERO DEPENDENCIES** - Only Bun and TypeScript allowed
- **Production-grade** - Must be suitable for real-world projects
- Build everything from scratch using Bun's APIs
- No shortcuts that would require external dependencies
