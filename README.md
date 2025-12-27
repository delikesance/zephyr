# Zephyr

A fast, lightweight, component-based templating engine that compiles .gzs files to HTML. Built for Bun with zero dependencies.

## Features

- 🚀 **Fast** - Optimized tokenizer, compiled expression caching, object pooling
- 🔒 **Secure** - XSS protection with auto-escaping, sandboxed expression evaluation
- 📦 **Zero Dependencies** - Pure TypeScript, runs on Bun
- 🧩 **Component-Based** - Imports, props, slots, styles
- 🔄 **Reactive Patterns** - Loops, conditionals, expressions
- ✅ **Production-Ready** - Instance-based architecture, comprehensive tests

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd zephyr

# Install dependencies (none required beyond Bun)
bun install
```

## Quick Start

```bash
# Compile and output to stdout
bun src/index.ts app/index.gzs

# Compile with verbose output
bun src/index.ts -v

# Compile to file
bun src/index.ts -o dist/index.html

# Run tests
bun test
```

## Component Format (.gzs)

```html
<!-- Imports -->
<import button from="./button.gzs" />
<import card from="./card.gzs" />

<!-- Styles (collected and deduplicated) -->
<style>
.container {
    max-width: 1200px;
    margin: 0 auto;
}
</style>

<!-- Script (component state) -->
<script>
    this.title = "Hello World";
    this.items = ["a", "b", "c"];
    this.isActive = true;
</script>

<!-- Template -->
<template>
    <div class="container">
        <h1>{{title}}</h1>
        
        <!-- Props -->
        <card :title="title" :count="items.length" />
        
        <!-- Loops -->
        <ul>
            <li each="item, index" in="items">
                {{index + 1}}. {{item}}
            </li>
        </ul>
        
        <!-- Conditionals -->
        <span if="isActive" class="active">Active</span>
        <span else class="inactive">Inactive</span>
        
        <!-- Slots -->
        <button>
            <strong>Click me!</strong>
        </button>
        
        <!-- Raw HTML (use with caution) -->
        <div>{{{trustedHtml}}}</div>
    </div>
</template>
```

## API Usage

### Basic Usage

```typescript
import { render } from "./src/index";

const { html, css } = await render("./app/index.gzs");
console.log(html);
console.log(css);
```

### Custom Configuration

```typescript
import { Zephyr } from "./src/index";

const zephyr = new Zephyr({
    maxRenderDepth: 50,    // Default: 100
    maxPoolSize: 10,       // Default: 20
    verbose: true,         // Default: false
    debug: false,          // Default: false
});

const { html, css } = await zephyr.render("./app/index.gzs");
```

### Multiple Renders (Reuse Instance)

```typescript
const zephyr = new Zephyr();

// First render
const page1 = await zephyr.render("./app/page1.gzs");

// Clear cache for fresh render
zephyr.clearCache();

// Second render
const page2 = await zephyr.render("./app/page2.gzs");
```

## Syntax Reference

### Expressions

```html
<!-- Escaped (safe) -->
{{expression}}

<!-- Raw HTML (trusted content only) -->
{{{rawHtml}}}
```

### Props

```html
<!-- Static value -->
<component :name="'literal string'" />

<!-- Dynamic value -->
<component :count="items.length" />
<component :user="users[0]" />
```

### Loops

```html
<!-- Basic loop -->
<li each="item" in="items">{{item}}</li>

<!-- With index -->
<li each="item, i" in="items">{{i}}: {{item}}</li>

<!-- On components -->
<card each="user" in="users" :name="user.name" />
```

### Conditionals

```html
<div if="condition">Shown when true</div>
<div else-if="other">Shown when other is true</div>
<div else>Fallback</div>
```

### Slots

```html
<!-- In parent -->
<wrapper>
    <p>This becomes slot content</p>
</wrapper>

<!-- In wrapper.gzs -->
<template>
    <div class="wrapper">
        <slot>Default content if empty</slot>
    </div>
</template>
```

### Styles

```html
<style>
.my-component {
    /* Styles are collected and deduplicated */
}
</style>
```

## Architecture

```
src/
├── index.ts       # Public API & CLI
├── core.ts        # Zephyr compiler class (instance-based)
├── compiler.ts    # Expression & script compilation
├── tokenizer.ts   # Lexer
├── parser.ts      # AST builder
└── errors.ts      # Error classes
```

## Error Handling

```typescript
import { 
    ZephyrError,
    TokenizerError,
    ParserError,
    CircularImportError,
    MaxDepthError 
} from "./src/index";

try {
    await zephyr.render("./broken.gzs");
} catch (e) {
    if (e instanceof CircularImportError) {
        console.error("Import cycle:", e.chain);
    } else if (e instanceof TokenizerError) {
        console.error(`Syntax error at line ${e.location?.line}`);
    }
}
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test src/compiler.test.ts

# Watch mode
bun test --watch
```

## Performance

- **Expression caching**: Compiled functions are cached by expression
- **Object pooling**: Loop contexts are reused to reduce GC pressure
- **Set-based deduplication**: O(1) style deduplication
- **Parallel loading**: Imports are loaded concurrently
- **No `with` statement**: Uses safe parameter injection

## Security

- **Auto-escaping**: All `{{expressions}}` are HTML-escaped by default
- **Sandboxed evaluation**: Expressions run in isolated function scope
- **No eval()**: Uses `new Function()` with explicit parameters
- **XSS protection**: Only `{{{triple braces}}}` output raw HTML

## License

MIT
