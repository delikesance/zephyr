#!/usr/bin/env bun
/**
 * Zephyr.js CLI
 * 
 * Commands:
 *   dev [dir]   - Start development server with hot reload
 *   build [dir] - Bundle for production
 * 
 * Zero dependencies - uses only Bun built-ins
 */

import { dev } from '../src/cli/dev.js'
import { build } from '../src/cli/build.js'

const VERSION = '0.1.0'

function printHelp(): void {
    console.log(`
⚡ Zephyr.js CLI v${VERSION}

Usage:
  zephyr <command> [options]

Commands:
  dev [dir]     Start development server with hot reload
  build [dir]   Bundle for production

Options:
  -p, --port <port>   Port for dev server (default: 3000)
  -h, --help          Show this help message
  -v, --version       Show version

Examples:
  zephyr dev                    # Start dev server in current directory
  zephyr dev ./my-app           # Start dev server for my-app
  zephyr dev -p 8080            # Start on port 8080
  zephyr build                  # Build for production
`)
}

function printVersion(): void {
    console.log(`zephyr v${VERSION}`)
}

interface ParsedArgs {
    command: string
    dir: string
    port: number
    help: boolean
    version: boolean
}

function parseArgs(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
        command: '',
        dir: '.',
        port: 3000,
        help: false,
        version: false,
    }

    let i = 0
    while (i < args.length) {
        const arg = args[i]
        if (!arg) {
            i++
            continue
        }

        if (arg === '-h' || arg === '--help') {
            result.help = true
        } else if (arg === '-v' || arg === '--version') {
            result.version = true
        } else if (arg === '-p' || arg === '--port') {
            i++
            const portArg = args[i]
            result.port = portArg ? parseInt(portArg, 10) || 3000 : 3000
        } else if (!arg.startsWith('-')) {
            if (!result.command) {
                result.command = arg
            } else {
                result.dir = arg
            }
        }
        i++
    }

    return result
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))

    if (args.version) {
        printVersion()
        process.exit(0)
    }

    if (args.help || !args.command) {
        printHelp()
        process.exit(args.help ? 0 : 1)
    }

    switch (args.command) {
        case 'dev':
            await dev({ dir: args.dir, port: args.port })
            break

        case 'build':
            await build({ dir: args.dir })
            break

        default:
            console.error(`Unknown command: ${args.command}`)
            printHelp()
            process.exit(1)
    }
}

main().catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
})
