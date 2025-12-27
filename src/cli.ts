#!/usr/bin/env bun
/**
 * Zephyr CLI
 * 
 * Command-line interface for the Zephyr templating engine.
 */

import { Zephyr } from "./core";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

// =============================================================================
// CLI Utilities
// =============================================================================

async function writeOutput(filePath: string, content: string): Promise<void> {
    const absPath = resolve(filePath);
    const dir = dirname(absPath);
    await mkdir(dir, { recursive: true });
    await writeFile(absPath, content, "utf-8");
}

function combineOutput(html: string, css: string, js: string | null): string {
    let result = html;

    // Inject CSS
    if (css.trim()) {
        if (result.includes("</head>")) {
            result = result.replace("</head>", `<style>\n${css}</style>\n</head>`);
        } else {
            result = `<style>\n${css}</style>\n${result}`;
        }
    }

    // Inject JS
    if (js) {
        if (result.includes("</body>")) {
            result = result.replace("</body>", `<script>\n${js}</script>\n</body>`);
        } else {
            result = `${result}\n<script>\n${js}</script>`;
        }
    }

    return result;
}

interface CLIArgs {
    entry: string;
    output: string | null;
    verbose: boolean;
    debug: boolean;
    help: boolean;
    version: boolean;
}

function parseArgs(args: string[]): CLIArgs {
    let entry = "./app/index.gzs";
    let output: string | null = null;
    let verbose = false;
    let debug = false;
    let help = false;
    let version = false;

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
        } else if (arg === "-V" || arg === "--version") {
            version = true;
        } else if (!arg.startsWith("-")) {
            entry = arg;
        }
    }

    return { entry, output, verbose, debug, help, version };
}

function printHelp(): void {
    console.log(`
Zephyr Compiler

Usage: zephyr [options] [entry]

Arguments:
  entry                 Entry component file (default: ./app/index.gzs)

Options:
  -o, --output <file>   Write output to file instead of stdout
  -v, --verbose         Show compilation progress
  -d, --debug           Show detailed debug info
  -V, --version         Show version number
  -h, --help            Show this help message

Examples:
  zephyr                             # Compile and print to stdout
  zephyr -v                          # Compile with progress info
  zephyr -o dist/index.html          # Compile and write to file
  zephyr app/page.gzs -o out.html    # Compile specific file
`);
}

function printVersion(): void {
    console.log("zephyr v0.1.0");
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main(): Promise<void> {
    const { entry, output, verbose, debug, help, version } = parseArgs(process.argv.slice(2));

    if (help) {
        printHelp();
        process.exit(0);
    }

    if (version) {
        printVersion();
        process.exit(0);
    }

    const startTime = performance.now();

    try {
        const zephyr = new Zephyr({ verbose, debug });
        const { html, css, js } = await zephyr.render(entry);
        const combined = combineOutput(html, css, js);

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

main();
