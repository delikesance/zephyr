/**
 * Zephyr
 * 
 * A fast, lightweight component-based templating engine.
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

export interface RenderOptions extends ZephyrConfig {
    /** Output file path (if not specified, returns result) */
    output?: string;
}

/**
 * Render a component file
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
 * Create a new Zephyr compiler instance with custom configuration
 */
export function createCompiler(config: ZephyrConfig = {}): Zephyr {
    return new Zephyr(config);
}

// =============================================================================
// CLI Utilities
// =============================================================================

async function writeOutput(filePath: string, content: string): Promise<void> {
    const absPath = resolve(filePath);
    const dir = dirname(absPath);
    await mkdir(dir, { recursive: true });
    await writeFile(absPath, content, "utf-8");
}

function combineOutput(html: string, css: string): string {
    if (!css.trim()) {
        return html;
    }

    if (html.includes("</head>")) {
        return html.replace("</head>", `<style>\n${css}</style>\n</head>`);
    }

    return `<style>\n${css}</style>\n${html}`;
}

interface CLIArgs {
    entry: string;
    output: string | null;
    verbose: boolean;
    debug: boolean;
    help: boolean;
}

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
