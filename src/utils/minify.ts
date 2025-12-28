/**
 * Minification utilities
 * 
 * Zero-dependency minifiers for HTML, CSS, and JavaScript
 * Optimized for performance
 */

/**
 * Minifies HTML by removing unnecessary whitespace
 */
export function minifyHTML(html: string): string {
  if (!html.trim()) return html
  
  // Remove comments
  let minified = html.replace(/<!--[\s\S]*?-->/g, '')
  
  // Remove whitespace between tags
  minified = minified.replace(/>\s+</g, '><')
  
  // Remove leading/trailing whitespace
  minified = minified.trim()
  
  // Remove whitespace at start/end of lines (but preserve in text content)
  // This is a simple approach - more sophisticated would preserve text whitespace
  minified = minified.replace(/\s+/g, ' ')
  
  // Remove spaces around certain characters
  minified = minified.replace(/\s*>\s*/g, '>')
  minified = minified.replace(/\s*<\s*/g, '<')
  minified = minified.replace(/\s*=\s*/g, '=')
  
  return minified
}

/**
 * Minifies CSS by removing unnecessary whitespace and comments
 */
export function minifyCSS(css: string): string {
  if (!css.trim()) return css
  
  let minified = css
  
  // Remove comments
  minified = minified.replace(/\/\*[\s\S]*?\*\//g, '')
  
  // Remove whitespace around selectors and properties
  minified = minified.replace(/\s*{\s*/g, '{')
  minified = minified.replace(/\s*}\s*/g, '}')
  minified = minified.replace(/\s*:\s*/g, ':')
  minified = minified.replace(/\s*;\s*/g, ';')
  minified = minified.replace(/\s*,\s*/g, ',')
  
  // Remove whitespace around @rules
  minified = minified.replace(/\s*@/g, '@')
  minified = minified.replace(/@(\w+)\s*\(/g, '@$1(')
  
  // Remove multiple spaces
  minified = minified.replace(/\s+/g, ' ')
  
  // Remove spaces before semicolons and closing braces
  minified = minified.replace(/\s*;\s*/g, ';')
  minified = minified.replace(/\s*}\s*/g, '}')
  
  // Remove leading/trailing whitespace
  minified = minified.trim()
  
  return minified
}

/**
 * Minifies JavaScript by removing unnecessary whitespace and comments
 * Note: This is a basic minifier. For production, you might want more sophisticated handling.
 */
export function minifyJS(js: string): string {
  if (!js.trim()) return js
  
  let minified = js
  
  // Remove single-line comments (but be careful with URLs and regex)
  // Simple approach: remove // comments that are on their own line or at end of line
  minified = minified.replace(/\/\/.*$/gm, '')
  
  // Remove multi-line comments (but preserve /*! */ style comments)
  minified = minified.replace(/\/\*(?!\!)[\s\S]*?\*\//g, '')
  
  // Remove whitespace around operators (but preserve in strings)
  // This is tricky - we need to be careful not to break code
  // Simple approach: remove spaces around common operators
  minified = minified.replace(/\s*([=+\-*/%<>!&|?:,;{}()\[\]])\s*/g, '$1')
  
  // Remove multiple spaces (but preserve in strings)
  minified = minified.replace(/\s+/g, ' ')
  
  // Remove spaces at start/end of lines
  minified = minified.replace(/^\s+|\s+$/gm, '')
  
  // Remove empty lines
  minified = minified.replace(/\n\s*\n/g, '\n')
  
  // Remove leading/trailing whitespace
  minified = minified.trim()
  
  return minified
}

/**
 * Minifies all three types based on options
 */
export function minifyOutput(
  html: string,
  css: string,
  js: string,
  options: { minifyHTML?: boolean; minifyCSS?: boolean; minifyJS?: boolean } = {}
): { html: string; css: string; js: string } {
  return {
    html: options.minifyHTML !== false ? minifyHTML(html) : html,
    css: options.minifyCSS !== false ? minifyCSS(css) : css,
    js: options.minifyJS !== false ? minifyJS(js) : js,
  }
}
