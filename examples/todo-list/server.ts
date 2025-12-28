import { Zephyr } from 'zephyr-js'
import Todo from './todo.zph'

const app = new Zephyr({ 
	port: 3000 
})

app.routes([
	{ path: "/", component: Todo }
])

await app.start()

console.log('🚀 Todo List example running on http://localhost:3000')
