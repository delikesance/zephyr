/**
 * @fileoverview Zephyr - A fast, lightweight component-based templating engine
 * 
 * Zephyr compiles `.gzs` component files to HTML with optional reactive JavaScript.
 * It supports component imports, props, slots, loops, conditionals, and scoped styles.
 * 
 * @example Basic usage
 * ```typescript
 * import { render } from "zephyr-template";
 * 
 * const { html, css, js } = await render("./app/index.gzs");
 * console.log(html);
 * ```
 * 
 * @example With custom configuration
 * ```typescript
 * import { Zephyr } from "zephyr-template";
 * 
 * const zephyr = new Zephyr({
 *     maxRenderDepth: 50,
 *     verbose: true,
 * });
 * 
 * const result = await zephyr.render("./app/index.gzs");
 * ```
 * 
 * @packageDocumentation
 * @module zephyr-template
 */

import { Zephyr } from "./core";
import type { ZephyrConfig, RenderResult, Component } from "./core";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

// =============================================================================
// Public API
// =============================================================================

export { Zephyr };
export type { ZephyrConfig, RenderResult, Component };
export * from "./errors";

/**
 * Options for the {@link render} function.
 * Extends {@link ZephyrConfig} with additional output options.
 * 
 * @example
 * ```typescript
 * const options: RenderOptions = {
 *     verbose: true,
 *     maxRenderDepth: 50,
 * };
 * ```
 */
export interface RenderOptions extends ZephyrConfig {
    /** 
     * Output file path. If specified, the compiled HTML will be written to this file.
     * If not specified, the result is returned without writing to disk.
     */
    output?: string;
}

/**
 * Render a Zephyr component file to HTML.
 * 
 * This is a convenience function that creates a new {@link Zephyr} instance,
 * renders the component, and returns the result. For multiple renders,
 * consider creating a single {@link Zephyr} instance and reusing it.
 * 
 * @param entryPath - Path to the entry `.gzs` component file
 * @param options - Optional configuration options
 * @returns A promise that resolves to the render result containing HTML, CSS, and optional JS
 * 
 * @example Basic render
 * ```typescript
 * const { html, css, js } = await render("./app/index.gzs");
 * ```
 * 
 * @example With options
 * ```typescript
 * const result = await render("./app/index.gzs", {
 *     verbose: true,
 *     maxRenderDepth: 50,
 * });
 * ```
 * 
 * @throws {ImportError} If the component file cannot be loaded
 * @throws {TokenizerError} If there's a syntax error in the component
 * @throws {ParserError} If the component structure is invalid
 * @throws {CircularImportError} If circular imports are detected
 * @throws {MaxDepthError} If component nesting exceeds maxRenderDepth
 */
export async function render(
    entryPath: string,
    options: RenderOptions = {}
): Promise<RenderResult> {
    const zephyr = new Zephyr({
        maxRenderDepth: options.maxRenderDepth,
        maxPoolSize: options.maxPoolSize,
        verbose: options.verbose,
        debug: options.debug,
    });

    return zephyr.render(entryPath);
}

/**
 * Create a new Zephyr compiler instance with custom configuration.
 * 
 * Use this when you need to render multiple components and want to
 * share caches between renders for better performance.
 * 
 * @param config - Optional configuration options
 * @returns A new {@link Zephyr} compiler instance
 * 
 * @example
 * ```typescript
 * const compiler = createCompiler({ verbose: true });
 * 
 * // Render multiple components with shared cache
 * const page1 = await compiler.render("./app/page1.gzs");
 * const page2 = await compiler.render("./app/page2.gzs");
 * 
 * // Clear cache between unrelated renders
 * compiler.clearCache();
 * ```
 */
export function createCompiler(config: ZephyrConfig = {}): Zephyr {
    return new Zephyr(config);
}

// =============================================================================
// CLI Utilities (Internal)
// =============================================================================

/** @internal */
async function writeOutput(filePath: string, content: string): Promise<void> {
    const absPath = resolve(filePath);
    const dir = dirname(absPath);
    await mkdir(dir, { recursive: true });
    await writeFile(absPath, content, "utf-8");
}

/** @internal */
function combineOutput(html: string, css: string): string {
    if (!css.trim()) {
        return html;
    }

    if (html.includes("</head>")) {
        return html.replace("</head>", `<style>\n${css}</style>\n</head>`);
    }

    return `<style>\n${css}</style>\n${html}`;
}

/** @internal */
interface CLIArgs {
    entry: string;
    output: string | null;
    verbose: boolean;
    debug: boolean;
    help: boolean;
}

/** @internal */
function parseArgs(args: string[]): CLIArgs {
    let entry = "./app/index.gzs";
    let output: string | null = null;
    let verbose = false;
    let debug = false;
    let help = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === "-o" || arg === "--output") {
            output = args[++i] || null;
        } else if (arg === "-v" || arg === "--verbose") {
            verbose = true;
        } else if (arg === "-d" || arg === "--debug") {
            debug = true;
        } else if (arg === "-h" || arg === "--help") {
            help = true;
        } else if (!arg.startsWith("-")) {
            entry = arg;
        }
    }

    return { entry, output, verbose, debug, help };
}

/** @internal */
function printHelp(): void {
    console.log(`
Zephyr Compiler

Usage: bun src/index.ts [options] [entry]

Arguments:
  entry                 Entry component file (default: ./app/index.gzs)

Options:
  -o, --output <file>   Write output to file instead of stdout
  -v, --verbose         Show compilation progress
  -d, --debug           Show detailed debug info
  -h, --help            Show this help message

Examples:
  bun src/index.ts                           # Compile and print to stdout
  bun src/index.ts -v                        # Compile with progress info
  bun src/index.ts -o dist/index.html        # Compile and write to file
  bun src/index.ts app/page.gzs -o out.html  # Compile specific file
`);
}

// =============================================================================
// CLI Entry Point
// =============================================================================

if (import.meta.main) {
    const { entry, output, verbose, debug, help } = parseArgs(process.argv.slice(2));

    if (help) {
        printHelp();
        process.exit(0);
    }

    const startTime = performance.now();

    try {
        const { html, css } = await render(entry, { verbose, debug });
        const combined = combineOutput(html, css);

        if (output) {
            await writeOutput(output, combined);
            if (verbose) {
                const duration = (performance.now() - startTime).toFixed(1);
                console.log(`✓ Compiled in ${duration}ms`);
                console.log(`✓ Written to ${resolve(output)}`);
            }
        } else {
            console.log(combined);
        }
    } catch (error) {
        console.error("Compilation failed:", error);
        process.exit(1);
    }
}
