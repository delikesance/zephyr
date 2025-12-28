import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Zephyr } from '../../src/server/server.js'
import { findRoute } from '../../src/server/router.js'

describe('Phase 6.1: Basic Server', () => {
    describe('Router', () => {
        it('should match exact routes', () => {
            const routes = [
                { path: '/', component: 'home.zph' },
                { path: '/about', component: 'about.zph' }
            ]

            expect(findRoute(routes, '/')).toEqual(routes[0])
            expect(findRoute(routes, '/about')).toEqual(routes[1])
            expect(findRoute(routes, '/missing')).toBeNull()
        })
    })

    describe('Zephyr Server', () => {
        let app: Zephyr
        const PORT = 4005 // Use a different port to avoid conflicts

        beforeAll(async () => {
            app = new Zephyr({ port: PORT })
            app.routes([
                { path: '/', component: 'virtual-home.zph' } // File doesn't exist, will error 500 if hit
            ])
            await app.start()
        })

        afterAll(() => {
            app.stop()
        })

        it('should return 404 for missing routes', async () => {
            const res = await fetch(`http://localhost:${PORT}/missing`)
            expect(res.status).toBe(404)
        })

        // We expect 500 because file doesn't exist, which proves route matching worked
        it('should attempt to serve route', async () => {
            const res = await fetch(`http://localhost:${PORT}/`)
            expect(res.status).toBe(500)
            const text = await res.text()
            expect(text).toContain('Component file not found')
        })
    })
})
