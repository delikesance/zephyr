import { Zephyr } from 'zephyr-js'
import BlogList from './blog-list.zph'
import BlogPost from './blog-post.zph'

interface BlogPostData {
	slug: string
	title: string
	content: string
	date: string
}

// Mock database
const POSTS: Record<string, BlogPostData> = {
	"first-post": {
		slug: "first-post",
		title: "First Post",
		content: "This is the first post content.",
		date: "2024-01-01"
	},
	"second-post": {
		slug: "second-post",
		title: "Second Post",
		content: "This is the second post content.",
		date: "2024-01-02"
	},
	"third-post": {
		slug: "third-post",
		title: "Third Post",
		content: "This is the third post content.",
		date: "2024-01-03"
	}
}

const app = new Zephyr({
	port: 3001
})

app.routes([
	{
		path: "/blog",
		component: BlogList,
		loader: async () => {
			return {
				posts: Object.values(POSTS)
			}
		}
	},
	{
		path: "/blog/:slug",
		component: BlogPost,
		loader: async ({ slug }) => {
			const post = POSTS[slug || '']

			if (!post) {
				return {
					post: {
						slug: "not-found",
						title: "Post Not Found",
						content: "Sorry, we couldn't find that post.",
						date: new Date().toISOString().split('T')[0]
					}
				}
			}

			return { post }
		}
	}
])

await app.start()

console.log('🚀 Blog example running on http://localhost:3001')
console.log('Visit http://localhost:3001/blog to see the list')
