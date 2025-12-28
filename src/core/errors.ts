/**
 * Error Handling System
 * 
 * Error = can't compile
 * Warning = must verify but can compile
 */

export interface CompileError {
  type: 'error' | 'warning'
  message: string
  file?: string
  line?: number
  column?: number
  suggestion?: string
  code?: string
}

export class CompilationError extends Error {
  constructor(
    public readonly error: CompileError
  ) {
    super(error.message)
    this.name = 'CompilationError'
  }
}

export class CompilationWarning {
  constructor(
    public readonly warning: CompileError
  ) {}
}

/**
 * Format error message for display
 */
export function formatError(error: CompileError): string {
  const parts: string[] = []
  
  // Severity indicator
  if (error.type === 'error') {
    parts.push('❌ Error')
  } else {
    parts.push('⚠️ Warning')
  }
  
  // Location
  if (error.file) {
    parts.push(` in ${error.file}`)
    if (error.line) {
      parts.push(` (line ${error.line}`)
      if (error.column) {
        parts.push(`, column ${error.column}`)
      }
      parts.push(')')
    }
  }
  
  parts.push(':')
  parts.push('\n   ')
  parts.push(error.message)
  
  // Code snippet
  if (error.code) {
    parts.push('\n\n   Code:')
    parts.push('\n   ')
    parts.push(error.code)
  }
  
  // Suggestion
  if (error.suggestion) {
    parts.push('\n\n   Suggestion:')
    parts.push('\n   ')
    parts.push(error.suggestion)
  }
  
  return parts.join('')
}

/**
 * Collect warnings during compilation
 */
export class WarningCollector {
  private warnings: CompileError[] = []
  
  add(warning: CompileError): void {
    this.warnings.push(warning)
  }
  
  getAll(): CompileError[] {
    return [...this.warnings]
  }
  
  hasWarnings(): boolean {
    return this.warnings.length > 0
  }
  
  formatAll(): string {
    return this.warnings.map(formatError).join('\n\n')
  }
}
