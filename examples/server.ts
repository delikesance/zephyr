import { Zephyr } from 'zephyr'

// Import all page components
import Index from './pages/index.zph'
import About from './pages/about.zph'
import Contact from './pages/contact.zph'
import BlogPost from './pages/blog-post.zph'
import NotFound from './pages/404.zph'

// Create the Zephyr application
const app = new Zephyr({ 
  port: 3000 
})

// Declare all routes in a single, static configuration
// This is fully analyzable for bundling and tree-shaking
app.routes([
  { path: "/", component: Index },
  { path: "/about", component: About },
  { path: "/contact", component: Contact },
  { path: "/blog/:slug", component: BlogPost },
  { path: "*", component: NotFound } // Catch-all for 404
])

// Start the server
await app.start()

console.log(`🚀 Zephyr server running on http://localhost:3000`)
