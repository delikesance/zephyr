/**
 * Zephyr CLI - Dev Command
 * 
 * Start a development server with hot reload
 */

import { watch } from 'fs'
import { resolve, join, relative } from 'path'
import { Zephyr } from '../server/server.js'

export interface DevOptions {
    dir: string
    port: number
}

interface HotReloadClient {
    ws: any // Bun WebSocket
    id: string
}

/**
 * Start the development server
 */
export async function dev(options: DevOptions): Promise<void> {
    const { dir, port } = options
    const projectDir = resolve(dir)

    console.log(`
⚡ Zephyr.js Dev Server
━━━━━━━━━━━━━━━━━━━━━━━
📁 Directory: ${projectDir}
🌐 URL: http://localhost:${port}
🔥 Hot reload: enabled
━━━━━━━━━━━━━━━━━━━━━━━
`)

    // Track connected clients for hot reload
    const clients: Set<HotReloadClient> = new Set()

    // Create Zephyr app for component compilation
    const app = new Zephyr({ port })

    // Find server.ts or index.ts in project directory
    const serverFile = await findServerFile(projectDir)

    if (serverFile) {
        console.log(`📝 Found server file: ${relative(projectDir, serverFile)}`)
        // Import and run the server file
        await import(serverFile)
    } else {
        console.log('⚠️  No server.ts found, starting empty server')
        console.log('   Create a server.ts with routes to get started')
        await app.start()
    }

    // Set up file watcher for hot reload
    setupFileWatcher(projectDir, clients)

    // Set up WebSocket server for hot reload
    setupHotReloadServer(port + 1, clients)

    console.log(`
✅ Server running!
   - App: http://localhost:${port}
   - Hot reload: ws://localhost:${port + 1}

Press Ctrl+C to stop
`)
}

/**
 * Find the server file in the project directory
 */
async function findServerFile(dir: string): Promise<string | null> {
    const candidates = ['server.ts', 'index.ts', 'src/server.ts', 'src/index.ts']

    for (const candidate of candidates) {
        const filePath = join(dir, candidate)
        const file = Bun.file(filePath)
        if (await file.exists()) {
            return filePath
        }
    }

    return null
}

/**
 * Set up file watcher for .zph files
 */
function setupFileWatcher(dir: string, clients: Set<HotReloadClient>): void {
    console.log('👀 Watching for file changes...')

    // Use Bun's watch API
    const watcher = watch(dir, { recursive: true }, (event, filename) => {
        if (!filename) return

        // Only reload for .zph file changes
        if (filename.endsWith('.zph') || filename.endsWith('.ts')) {
            console.log(`\n🔄 File changed: ${filename}`)
            notifyClients(clients)
        }
    })

    // Handle process exit
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down...')
        watcher.close()
        process.exit(0)
    })
}

/**
 * Notify all connected clients to reload
 */
function notifyClients(clients: Set<HotReloadClient>): void {
    const message = JSON.stringify({ type: 'reload' })

    for (const client of clients) {
        try {
            client.ws.send(message)
        } catch {
            clients.delete(client)
        }
    }

    console.log(`   📤 Sent reload signal to ${clients.size} client(s)`)
}

/**
 * Set up WebSocket server for hot reload
 */
function setupHotReloadServer(port: number, clients: Set<HotReloadClient>): void {
    Bun.serve({
        port,
        fetch(req, server) {
            // Upgrade to WebSocket
            if (server.upgrade(req)) {
                return // Upgraded
            }
            return new Response('Zephyr Hot Reload Server', { status: 200 })
        },
        websocket: {
            open(ws) {
                const client: HotReloadClient = {
                    ws,
                    id: Math.random().toString(36).substr(2, 9),
                }
                clients.add(client)
                console.log(`🔌 Client connected (${clients.size} total)`)
            },
            close(ws) {
                for (const client of clients) {
                    if (client.ws === ws) {
                        clients.delete(client)
                        break
                    }
                }
                console.log(`🔌 Client disconnected (${clients.size} total)`)
            },
            message(ws, message) {
                // Handle ping/pong for keep-alive
                if (message === 'ping') {
                    ws.send('pong')
                }
            },
        },
    })
}
