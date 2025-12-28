/**
 * Zephyr CLI - Build Command
 * 
 * Bundle for production
 */

import { resolve, join, relative } from 'path'
import { compileZephyrFile } from '../core/compiler.js'

export interface BuildOptions {
    dir: string
}

/**
 * Build the project for production
 */
export async function build(options: BuildOptions): Promise<void> {
    const { dir } = options
    const projectDir = resolve(dir)
    const outputDir = join(projectDir, 'dist')

    console.log(`
⚡ Zephyr.js Build
━━━━━━━━━━━━━━━━━━
📁 Source: ${projectDir}
📦 Output: ${outputDir}
━━━━━━━━━━━━━━━━━━
`)

    const startTime = performance.now()

    // Find all .zph files
    const glob = new Bun.Glob('**/*.zph')
    const files: string[] = []

    for await (const file of glob.scan({ cwd: projectDir })) {
        files.push(file)
    }

    if (files.length === 0) {
        console.log('⚠️  No .zph files found')
        return
    }

    console.log(`📝 Found ${files.length} component(s)`)

    // Create output directory
    await Bun.write(join(outputDir, '.gitkeep'), '')

    // Compile each file
    let successCount = 0
    let errorCount = 0

    for (const file of files) {
        const inputPath = join(projectDir, file)
        const outputPath = join(outputDir, file.replace('.zph', '.html'))

        try {
            const content = await Bun.file(inputPath).text()
            const result = compileZephyrFile(content, file, {
                minifyHTML: true,
                minifyCSS: true,
                minifyJS: false // JS minifier breaks template literals
            })

            // Generate full HTML
            const html = generateFullHTML(result, file)

            // Write output
            await Bun.write(outputPath, html)

            console.log(`   ✅ ${relative(projectDir, inputPath)}`)
            successCount++
        } catch (error: any) {
            console.error(`   ❌ ${file}: ${error.message}`)
            errorCount++
        }
    }

    const duration = (performance.now() - startTime).toFixed(2)

    console.log(`
━━━━━━━━━━━━━━━━━━
✅ Build complete!
   ${successCount} succeeded, ${errorCount} failed
   ⏱️  ${duration}ms
`)
}

/**
 * Generate a full HTML document from compiled result
 */
function generateFullHTML(
    result: { html: string; css: string; js: string },
    filename: string
): string {
    const title = filename.replace('.zph', '').replace(/[-_]/g, ' ')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${result.css}</style>
</head>
<body>
  ${result.html}
  <script type="module">${result.js}</script>
</body>
</html>`
}
