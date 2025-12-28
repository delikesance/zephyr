import { Zephyr } from 'zephyr-js'
import Counter from './counter.zph'

const app = new Zephyr({ 
	port: 3000 
})

app.routes([
	{ path: "/", component: Counter }
])

await app.start()

console.log('🚀 Counter example running on http://localhost:3000')
