import { Zephyr } from 'zephyr-js'
import Index from './index.zph'
import About from './about.zph'
import Contact from './contact.zph'

const app = new Zephyr({ 
	port: 3000 
})

app.routes([
	{ path: "/", component: Index },
	{ path: "/about", component: About },
	{ path: "/contact", component: Contact }
])

await app.start()

console.log('🚀 Multi-page example running on http://localhost:3000')
