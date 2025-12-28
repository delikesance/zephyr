import { CompilationError } from './errors.js';

/**
 * Process component script using Bun's transpiler
 * 
 * @param script - The TypeScript code from the component
 * @param filename - The component filename for error reporting
 * @returns Transpiled JavaScript code
 */
export function processScript(script: string, filename: string): { content: string, imports: string[] } {
    if (!script.trim()) {
        return { content: '', imports: [] };
    }

    try {
        const transpiler = new Bun.Transpiler({
            loader: 'ts',
            target: 'browser', // Zephyr runs in the browser
            minifyWhitespace: false, // We'll minify later if requested
            treeShaking: false, // We want to keep everything for now
        });

        // Transpile the script
        let js = transpiler.transformSync(script);

        // Extract imports
        const imports: string[] = [];
        const importRegex = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"][^'"]+['"];?/gm;

        let match;
        while ((match = importRegex.exec(js)) !== null) {
            imports.push(match[0].trim());
        }

        // Remove imports from body
        js = js.replace(importRegex, '').trim();



        return { content: js, imports };
    } catch (error) {
        throw new CompilationError({
            type: 'error',
            message: `Script compilation failed: ${error instanceof Error ? error.message : String(error)}\nSource script:\n${script}`,
            file: filename,
            // Attempt to extract line number from error if possible, but Bun's error might be generic
        });
    }
}
