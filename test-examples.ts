/**
 * Test compiler on all examples
 * 
 * Run with: bun run test-examples.ts
 */

import { compileZephyrFile } from './src/core/compiler.js'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

async function testExample(examplePath: string) {
  const files = await readdir(examplePath)
  const zphFile = files.find(f => f.endsWith('.zph'))
  
  if (!zphFile) {
    console.log(`⚠️  No .zph file found in ${examplePath}`)
    return false
  }
  
  const filePath = join(examplePath, zphFile)
  const content = await readFile(filePath, 'utf-8')
  
  try {
    console.log(`\n📦 Testing: ${zphFile}`)
    console.log('─'.repeat(50))
    
    const result = compileZephyrFile(content, zphFile)
    
    console.log('✅ Compilation successful!')
    console.log(`   Component: ${result.component.name}`)
    console.log(`   Scope ID: ${result.component.scopeId}`)
    console.log(`   HTML length: ${result.html.length} chars`)
    console.log(`   CSS length: ${result.css.length} chars`)
    console.log(`   JS length: ${result.js.length} chars`)
    
    // Show preview
    console.log('\n   HTML Preview:')
    const htmlPreview = result.html.split('\n').slice(0, 3).join('\n')
    console.log('   ' + htmlPreview.split('\n').join('\n   '))
    if (result.html.split('\n').length > 3) {
      console.log('   ...')
    }
    
    return true
  } catch (error) {
    console.error(`❌ Compilation failed:`, error)
    return false
  }
}

async function main() {
  console.log('🧪 Testing Zephyr.js Compiler on Examples\n')
  
  const examplesDir = './examples'
  const examples = await readdir(examplesDir, { withFileTypes: true })
  
  const exampleDirs = examples
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
  
  let passed = 0
  let failed = 0
  
  for (const exampleDir of exampleDirs) {
    const examplePath = join(examplesDir, exampleDir)
    const success = await testExample(examplePath)
    
    if (success) {
      passed++
    } else {
      failed++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('✅ All examples compiled successfully!')
    process.exit(0)
  } else {
    console.log('❌ Some examples failed to compile')
    process.exit(1)
  }
}

main().catch(console.error)
