# Zephyr.js Tests

This directory contains all tests for Zephyr.js, organized by roadmap phases and concerns.

## Test Structure

```
tests/
├── phase1/              # Phase 1: Core Foundation
│   ├── parser.test.ts    # Parser tests
│   ├── component.test.ts # Component structure tests
│   └── compiler.test.ts # Compiler tests
├── phase2/              # Phase 2: Style Scoping
├── phase3/              # Phase 3: Template Compilation
├── phase4/              # Phase 4: JavaScript Processing
├── phase5/              # Phase 5: Component Composition
├── phase6/              # Phase 6: Build System
├── dx/                  # Developer Experience tests
│   └── error-messages.test.ts
├── performance/         # Performance benchmarks
│   └── benchmarks.ts
└── utils/               # Test utilities and helpers
    ├── test-helpers.ts
    └── error-helpers.ts
```

## Running Tests

### All Tests
```bash
bun test
```

### By Phase
```bash
bun test:phase1        # Phase 1 tests
bun test tests/phase2  # Phase 2 tests
```

### By Concern
```bash
bun test:dx           # Developer experience tests
bun test:performance  # Performance benchmarks
```

### Specific Test File
```bash
bun test tests/phase1/parser.test.ts
```

### Watch Mode
```bash
bun test:watch        # Watch all tests
bun test --watch tests/phase1  # Watch specific directory
```

### Benchmarks
```bash
bun benchmark         # Run performance benchmarks
```

## Test Philosophy

- **Zero Dependencies**: Use only Bun's built-in test runner
- **Comprehensive**: Test all functionality, edge cases, and error conditions
- **Fast**: Tests should run quickly (< 100ms total)
- **Clear**: Test names should clearly describe what they test
- **Isolated**: Each test should be independent
- **Performance**: Benchmark critical paths
- **DX**: Test error messages and developer experience

## Writing Tests

### Basic Test
```typescript
import { describe, it, expect } from 'bun:test'

describe('Feature Name', () => {
  it('should do something', () => {
    expect(true).toBe(true)
  })
})
```

### Performance Test
```typescript
import { bench } from 'bun:test'

bench('operation name', () => {
  // Code to benchmark
}, { time: 1000 }) // Run for 1 second
```

### Error Message Test
```typescript
import { expectError } from '../utils/error-helpers.js'

it('should provide helpful error message', () => {
  try {
    // Code that throws
  } catch (error) {
    expectError(error, {
      message: 'expected error text',
      file: 'file.zph',
      line: 5,
      suggestion: 'how to fix it'
    })
  }
})
```

## Test Coverage Goals

- **Unit Tests**: 100% coverage of core functionality
- **Integration Tests**: All example apps should work
- **Performance Tests**: All critical paths benchmarked
- **DX Tests**: All error messages tested for quality
- **Edge Cases**: All edge cases covered

## Performance Targets

- **Parser**: < 0.5ms per file
- **Compiler**: < 1ms per component
- **Memory**: < 10MB for 1000 components
- **Test Suite**: < 100ms total runtime

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Add performance benchmarks if applicable
4. Test error messages for clarity
5. Update this README if needed
