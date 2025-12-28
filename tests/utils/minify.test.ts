/**
 * Minification Tests
 */

import { describe, it, expect } from 'bun:test'
import { minifyHTML, minifyCSS, minifyJS } from '../../src/utils/minify.js'

describe('Minification', () => {
  describe('minifyHTML', () => {
    it('should remove unnecessary whitespace', () => {
      const html = `
        <div class="test">
          <p>Hello</p>
        </div>
      `
      const minified = minifyHTML(html)
      
      expect(minified).not.toContain('\n')
      expect(minified).toContain('<div class="test">')
      expect(minified).toContain('<p>Hello</p>')
    })
    
    it('should remove comments', () => {
      const html = '<div><!-- comment --><p>Test</p></div>'
      const minified = minifyHTML(html)
      
      expect(minified).not.toContain('<!--')
      expect(minified).not.toContain('comment')
      expect(minified).toContain('<p>Test</p>')
    })
    
    it('should preserve content', () => {
      const html = '<div class="test">Hello World</div>'
      const minified = minifyHTML(html)
      
      expect(minified).toContain('Hello World')
      expect(minified).toContain('class="test"')
    })
  })
  
  describe('minifyCSS', () => {
    it('should remove unnecessary whitespace', () => {
      const css = `
        .test {
          color: red;
          padding: 20px;
        }
      `
      const minified = minifyCSS(css)
      
      expect(minified).not.toContain('\n')
      expect(minified).toContain('.test{')
      expect(minified).toContain('color:red')
      expect(minified).toContain('padding:20px')
    })
    
    it('should remove comments', () => {
      const css = '.test { /* comment */ color: red; }'
      const minified = minifyCSS(css)
      
      expect(minified).not.toContain('/*')
      expect(minified).not.toContain('comment')
      expect(minified).toContain('color:red')
    })
    
    it('should handle @media queries', () => {
      const css = `
        @media (max-width: 600px) {
          .test { color: blue; }
        }
      `
      const minified = minifyCSS(css)
      
      expect(minified).toContain('@media')
      expect(minified).toContain('(max-width:600px)')
      expect(minified).toContain('.test{color:blue')
    })
  })
  
  describe('minifyJS', () => {
    it('should remove unnecessary whitespace', () => {
      const js = `
        let count = 0;
        function increment() {
          count++;
        }
      `
      const minified = minifyJS(js)
      
      expect(minified.length).toBeLessThan(js.length)
      expect(minified).toContain('let count=0')
      expect(minified).toContain('function increment()')
    })
    
    it('should remove single-line comments', () => {
      const js = 'let x = 1; // comment\nlet y = 2;'
      const minified = minifyJS(js)
      
      expect(minified).not.toContain('//')
      expect(minified).not.toContain('comment')
      expect(minified).toContain('let x=1')
      expect(minified).toContain('let y=2')
    })
    
    it('should remove multi-line comments', () => {
      const js = 'let x = 1; /* comment */ let y = 2;'
      const minified = minifyJS(js)
      
      expect(minified).not.toContain('/*')
      expect(minified).not.toContain('comment')
      expect(minified).toContain('let x=1')
      expect(minified).toContain('let y=2')
    })
  })
})
