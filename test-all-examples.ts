/**
 * Test all .zph files in all examples
 * 
 * Run with: bun run test-all-examples.ts
 */

import { compileZephyrFile } from './src/core/compiler.js'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

async function getAllZphFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    
    if (entry.isDirectory()) {
      const subFiles = await getAllZphFiles(fullPath)
      files.push(...subFiles)
    } else if (entry.isFile() && entry.name.endsWith('.zph')) {
      files.push(fullPath)
    }
  }
  
  return files
}

async function testFile(filePath: string) {
  const content = await readFile(filePath, 'utf-8')
  const fileName = filePath.split('/').pop() || 'unknown.zph'
  
  try {
    const start = performance.now()
    const result = compileZephyrFile(content, fileName)
    const duration = performance.now() - start
    
    const relativePath = filePath.replace(process.cwd() + '/', '')
    
    return {
      success: true,
      path: relativePath,
      component: result.component.name,
      scopeId: result.component.scopeId,
      htmlLength: result.html.length,
      cssLength: result.css.length,
      jsLength: result.js.length,
      duration,
    }
  } catch (error) {
    return {
      success: false,
      path: filePath.replace(process.cwd() + '/', ''),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🧪 Testing All Examples\n')
  
  const examplesDir = './examples'
  const zphFiles = await getAllZphFiles(examplesDir)
  
  if (zphFiles.length === 0) {
    console.log('❌ No .zph files found in examples directory')
    process.exit(1)
  }
  
  console.log(`Found ${zphFiles.length} .zph file(s)\n`)
  
  const results = await Promise.all(zphFiles.map(testFile))
  
  let passed = 0
  let failed = 0
  let totalDuration = 0
  
  console.log('Results:\n')
  console.log('─'.repeat(80))
  
  for (const result of results) {
    if (result.success) {
      passed++
      totalDuration += result.duration
      console.log(`✅ ${result.path}`)
      console.log(`   Component: ${result.component} | Scope: ${result.scopeId}`)
      console.log(`   Output: HTML(${result.htmlLength}) CSS(${result.cssLength}) JS(${result.jsLength})`)
      console.log(`   Duration: ${result.duration.toFixed(3)}ms`)
    } else {
      failed++
      console.log(`❌ ${result.path}`)
      console.log(`   Error: ${result.error}`)
    }
    console.log('')
  }
  
  console.log('─'.repeat(80))
  console.log(`\n📊 Summary:`)
  console.log(`   Total files: ${zphFiles.length}`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  if (passed > 0) {
    console.log(`   ⚡ Average compile time: ${(totalDuration / passed).toFixed(3)}ms`)
    console.log(`   ⚡ Total compile time: ${totalDuration.toFixed(3)}ms`)
  }
  
  if (failed === 0) {
    console.log('\n🎉 All examples compiled successfully!')
    process.exit(0)
  } else {
    console.log('\n❌ Some examples failed to compile')
    process.exit(1)
  }
}

main().catch(console.error)
