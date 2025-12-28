/**
 * Error message testing utilities
 * 
 * Helps test that error messages are clear and helpful
 */

export interface ErrorExpectation {
  message: string
  file?: string
  line?: number
  suggestion?: string
  severity?: 'error' | 'warning' | 'info'
}

/**
 * Assert that an error message matches expectations
 */
export function expectError(
  error: Error,
  expectation: ErrorExpectation
): void {
  const message = error.message
  
  // Check that message contains expected text
  if (expectation.message) {
    expect(message).toContain(expectation.message)
  }
  
  // Check file location if specified
  if (expectation.file) {
    expect(message).toContain(expectation.file)
  }
  
  // Check line number if specified
  if (expectation.line) {
    expect(message).toContain(`line ${expectation.line}`)
  }
  
  // Check suggestion if specified
  if (expectation.suggestion) {
    expect(message).toContain(expectation.suggestion)
  }
}

/**
 * Test error message quality
 */
export function testErrorMessageQuality(error: Error): {
  hasLocation: boolean
  hasContext: boolean
  hasSolution: boolean
  score: number
} {
  const message = error.message
  const hasLocation = /line \d+|at .+\.zph/.test(message)
  const hasContext = /(?:Error|Warning|Info|Available|Context)/.test(message)
  const hasSolution = /(?:Fix|Solution|Try|Use|Consider):/i.test(message)
  
  let score = 0
  if (hasLocation) score += 1
  if (hasContext) score += 1
  if (hasSolution) score += 1
  
  return { hasLocation, hasContext, hasSolution, score }
}
