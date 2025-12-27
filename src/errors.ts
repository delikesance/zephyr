/**
 * Zephyr Error Classes
 * 
 * Provides detailed error information including source locations.
 */

export interface SourceLocation {
    file?: string;
    line: number;
    column: number;
}

/**
 * Base class for all Zephyr errors
 */
export class ZephyrError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly location?: SourceLocation
    ) {
        super(ZephyrError.formatMessage(message, location));
        this.name = "ZephyrError";
    }

    private static formatMessage(message: string, location?: SourceLocation): string {
        if (!location) return message;
        
        const parts = [message];
        if (location.file) {
            parts.push(`in ${location.file}`);
        }
        parts.push(`at line ${location.line}, column ${location.column}`);
        
        return parts.join(" ");
    }
}

/**
 * Tokenizer/Lexer errors
 */
export class TokenizerError extends ZephyrError {
    constructor(message: string, line: number, column: number, file?: string) {
        super(message, "TOKENIZER_ERROR", { file, line, column });
        this.name = "TokenizerError";
    }
}

/**
 * Parser errors
 */
export class ParserError extends ZephyrError {
    constructor(message: string, line: number, column: number, file?: string) {
        super(message, "PARSER_ERROR", { file, line, column });
        this.name = "ParserError";
    }
}

/**
 * Compilation errors (expression/script evaluation)
 */
export class CompilationError extends ZephyrError {
    constructor(message: string, expression?: string, location?: SourceLocation) {
        const fullMessage = expression 
            ? `${message} in expression: ${expression.substring(0, 50)}${expression.length > 50 ? '...' : ''}`
            : message;
        super(fullMessage, "COMPILATION_ERROR", location);
        this.name = "CompilationError";
    }
}

/**
 * Render errors
 */
export class RenderError extends ZephyrError {
    constructor(message: string, component?: string) {
        super(message, "RENDER_ERROR", component ? { file: component, line: 0, column: 0 } : undefined);
        this.name = "RenderError";
    }
}

/**
 * Import/loading errors
 */
export class ImportError extends ZephyrError {
    constructor(message: string, file?: string) {
        super(message, "IMPORT_ERROR", file ? { file, line: 0, column: 0 } : undefined);
        this.name = "ImportError";
    }
}

/**
 * Circular import error
 */
export class CircularImportError extends ImportError {
    constructor(public readonly chain: string[]) {
        super(`Circular import detected: ${chain.join(" → ")}`);
        this.name = "CircularImportError";
    }
}

/**
 * Max depth exceeded error
 */
export class MaxDepthError extends RenderError {
    constructor(depth: number, component?: string) {
        super(`Maximum render depth (${depth}) exceeded. Possible infinite component recursion.`, component);
        this.name = "MaxDepthError";
    }
}
