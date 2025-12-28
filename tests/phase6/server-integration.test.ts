import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Zephyr } from '../../src/server/server.js'
import { findRoute } from '../../src/server/router.js'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'

describe('Phase 6.1: Basic Server', () => {
    // ... previous tests ...
    describe('Integration with Content', () => {
        let app: Zephyr
        const PORT = 4001
        const TEMP_FILE = join(process.cwd(), 'tests/temp/served.zph')

        beforeAll(async () => {
            // Create temp file
            writeFileSync(TEMP_FILE, '<template>Hello Server</template>')

            app = new Zephyr({ port: PORT })
            app.routes([
                { path: '/hello', component: TEMP_FILE }
            ])
            await app.start()
        })

        afterAll(() => {
            app.stop()
            if (typeof unlinkSync === 'function') {
                // unlinkSync(TEMP_FILE)
            }
        })

        it('should serve compiled content', async () => {
            const res = await fetch(`http://localhost:${PORT}/hello`)
            expect(res.status).toBe(200)
            const html = await res.text()
            expect(html).toContain('Hello Server')
            expect(html).toContain('<!DOCTYPE html>')
        })
    })
})
