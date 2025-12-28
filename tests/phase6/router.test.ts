
import { describe, it, expect } from 'bun:test'
import { findRoute, extractParams } from '../../src/server/router'
import type { Route } from '../../src/types/server'

describe('Router', () => {
    const routes: Route[] = [
        { path: '/', component: 'Home' },
        { path: '/blog', component: 'BlogList' },
        { path: '/blog/:slug', component: 'BlogPost' },
        { path: '/users/:id/profile', component: 'UserProfile' }
    ]

    describe('findRoute', () => {
        it('should find exact matches', () => {
            const route = findRoute(routes, '/blog')
            expect(route).not.toBeNull()
            expect(route?.path).toBe('/blog')
        })

        it('should find dynamic matches', () => {
            const route = findRoute(routes, '/blog/my-first-post')
            expect(route).not.toBeNull()
            expect(route?.path).toBe('/blog/:slug')
        })

        it('should find complex dynamic matches', () => {
            const route = findRoute(routes, '/users/123/profile')
            expect(route).not.toBeNull()
            expect(route?.path).toBe('/users/:id/profile')
        })

        it('should return null for non-matching routes', () => {
            expect(findRoute(routes, '/unknown')).toBeNull()
            expect(findRoute(routes, '/blog/post/extra')).toBeNull()
        })
    })

    describe('extractParams', () => {
        it('should extract simple parameters', () => {
            const params = extractParams('/blog/:slug', '/blog/my-post')
            expect(params).toEqual({ slug: 'my-post' })
        })

        it('should extract multiple parameters', () => {
            const params = extractParams('/users/:id/posts/:postId', '/users/123/posts/456')
            expect(params).toEqual({ id: '123', postId: '456' })
        })

        it('should return empty object for no parameters', () => {
            const params = extractParams('/blog', '/blog')
            expect(params).toEqual({})
        })
    })
})
