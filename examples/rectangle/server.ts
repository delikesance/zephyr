import { Zephyr } from 'zephyr-js'
import Index from './index.zph'

const app = new Zephyr({ 
	port: 3000 
})

app.routes([
	{ path: "/", component: Index },
])

await app.start()

console.log('🚀 Multi-page example running on http://localhost:3000')
