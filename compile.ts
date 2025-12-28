/**
 * Compile a .zph file and show the output
 * 
 * Usage: bun run compile.ts <path-to-file.zph>
 * Example: bun run compile.ts examples/basic-counter/counter.zph
 */

import { compileZephyrFile } from './src/core/compiler.js'
import { readFile } from 'fs/promises'

async function main() {
  const filePath = process.argv[2]
  const minify = process.argv.includes('--minify') || process.argv.includes('-m')
  
  if (!filePath) {
    console.log('Usage: bun run compile.ts <path-to-file.zph> [--minify]')
    console.log('Example: bun run compile.ts examples/basic-counter/counter.zph')
    console.log('Example: bun run compile.ts examples/basic-counter/counter.zph --minify')
    process.exit(1)
  }
  
  if (!filePath.endsWith('.zph')) {
    console.error('❌ Error: File must be a .zph file')
    process.exit(1)
  }
  
  try {
    const content = await readFile(filePath, 'utf-8')
    const fileName = filePath.split('/').pop() || 'unknown.zph'
    
    console.log(`📦 Compiling: ${filePath}${minify ? ' (minified)' : ''}\n`)
    
    const result = compileZephyrFile(content, fileName, { minify })
    
    console.log('='.repeat(70))
    console.log('📄 HTML OUTPUT')
    console.log('='.repeat(70))
    console.log(result.html)
    console.log('\n')
    
    console.log('='.repeat(70))
    console.log('🎨 CSS OUTPUT')
    console.log('='.repeat(70))
    console.log(result.css)
    console.log('\n')
    
    console.log('='.repeat(70))
    console.log('⚡ JAVASCRIPT OUTPUT')
    console.log('='.repeat(70))
    console.log(result.js)
    console.log('\n')
    
    console.log('='.repeat(70))
    console.log('ℹ️  COMPONENT INFO')
    console.log('='.repeat(70))
    console.log(`Name: ${result.component.name}`)
    console.log(`Scope ID: ${result.component.scopeId}`)
    const originalContent = await readFile(filePath, 'utf-8')
    const originalSize = originalContent.length
    const compiledSize = result.html.length + result.css.length + result.js.length
    
    console.log(`HTML length: ${result.html.length} chars`)
    console.log(`CSS length: ${result.css.length} chars`)
    console.log(`JS length: ${result.js.length} chars`)
    console.log(`Total output: ${compiledSize} chars`)
    if (minify) {
      console.log(`Original size: ${originalSize} chars`)
      console.log(`Compression: ${((1 - compiledSize / originalSize) * 100).toFixed(1)}%`)
    }
    console.log('\n✅ Compilation successful!\n')
    
  } catch (error) {
    console.error('❌ Compilation failed:')
    if (error instanceof Error) {
      console.error(error.message)
      if (error.stack) {
        console.error('\nStack trace:')
        console.error(error.stack)
      }
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}

main()
