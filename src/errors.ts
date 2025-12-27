/**
 * @fileoverview Zephyr Error Classes
 * 
 * Provides a hierarchy of error classes for different types of compilation
 * and runtime errors, each with detailed source location information.
 * 
 * @example Catching specific errors
 * ```typescript
 * import { 
 *     ZephyrError, 
 *     CircularImportError, 
 *     TokenizerError 
 * } from "zephyr-template";
 * 
 * try {
 *     await zephyr.render("./broken.gzs");
 * } catch (e) {
 *     if (e instanceof CircularImportError) {
 *         console.error("Import cycle:", e.chain);
 *     } else if (e instanceof TokenizerError) {
 *         console.error(`Syntax error at line ${e.location?.line}`);
 *     }
 * }
 * ```
 * 
 * @packageDocumentation
 * @module zephyr-template/errors
 */

/**
 * Represents a location in source code.
 * Used by error classes to provide precise error locations.
 */
export interface SourceLocation {
    /** The file path where the error occurred */
    file?: string;
    /** The line number (1-indexed) */
    line: number;
    /** The column number (1-indexed) */
    column: number;
}

/**
 * Base class for all Zephyr errors.
 * 
 * All Zephyr-specific errors extend this class, making it easy to catch
 * any Zephyr-related error while still being able to differentiate
 * between error types.
 * 
 * @example
 * ```typescript
 * try {
 *     await zephyr.render("./component.gzs");
 * } catch (e) {
 *     if (e instanceof ZephyrError) {
 *         console.error(`Zephyr error [${e.code}]: ${e.message}`);
 *         if (e.location) {
 *             console.error(`  at ${e.location.file}:${e.location.line}:${e.location.column}`);
 *         }
 *     }
 * }
 * ```
 */
export class ZephyrError extends Error {
    /**
     * Creates a new ZephyrError.
     * 
     * @param message - Human-readable error description
     * @param code - Machine-readable error code (e.g., "TOKENIZER_ERROR")
     * @param location - Optional source location where the error occurred
     */
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
 * Error thrown during tokenization (lexical analysis).
 * 
 * This error indicates a syntax error in the component file,
 * such as unclosed tags or invalid characters.
 * 
 * @example
 * ```typescript
 * // This would throw TokenizerError: unclosed <script> tag
 * // <script>this.x = 1
 * ```
 */
export class TokenizerError extends ZephyrError {
    /**
     * Creates a new TokenizerError.
     * 
     * @param message - Description of the tokenization error
     * @param line - Line number where the error occurred
     * @param column - Column number where the error occurred
     * @param file - Optional file path
     */
    constructor(message: string, line: number, column: number, file?: string) {
        super(message, "TOKENIZER_ERROR", { file, line, column });
        this.name = "TokenizerError";
    }
}

/**
 * Error thrown during parsing (syntax analysis).
 * 
 * This error indicates a structural problem with the component,
 * such as mismatched tags or invalid attribute syntax.
 * 
 * @example
 * ```typescript
 * // This would throw ParserError: expected closing tag
 * // <template><div></template>
 * ```
 */
export class ParserError extends ZephyrError {
    /**
     * Creates a new ParserError.
     * 
     * @param message - Description of the parsing error
     * @param line - Line number where the error occurred
     * @param column - Column number where the error occurred
     * @param file - Optional file path
     */
    constructor(message: string, line: number, column: number, file?: string) {
        super(message, "PARSER_ERROR", { file, line, column });
        this.name = "ParserError";
    }
}

/**
 * Error thrown during expression or script compilation.
 * 
 * This error indicates a problem with JavaScript expressions
 * in templates or script blocks, such as syntax errors or
 * references to undefined variables.
 * 
 * @example
 * ```typescript
 * // This would throw CompilationError
 * // {{invalid syntax here}}
 * ```
 */
export class CompilationError extends ZephyrError {
    /**
     * Creates a new CompilationError.
     * 
     * @param message - Description of the compilation error
     * @param expression - The expression that caused the error (truncated to 50 chars)
     * @param location - Optional source location
     */
    constructor(message: string, expression?: string, location?: SourceLocation) {
        const fullMessage = expression
            ? `${message} in expression: ${expression.substring(0, 50)}${expression.length > 50 ? '...' : ''}`
            : message;
        super(fullMessage, "COMPILATION_ERROR", location);
        this.name = "CompilationError";
    }
}

/**
 * Error thrown during component rendering.
 * 
 * This error indicates a problem that occurred while rendering
 * a component, such as missing required props or invalid loop arrays.
 */
export class RenderError extends ZephyrError {
    /**
     * Creates a new RenderError.
     * 
     * @param message - Description of the render error
     * @param component - Optional component file path where the error occurred
     */
    constructor(message: string, component?: string) {
        super(message, "RENDER_ERROR", component ? { file: component, line: 0, column: 0 } : undefined);
        this.name = "RenderError";
    }
}

/**
 * Error thrown when a component import fails.
 * 
 * This error indicates that a component file could not be loaded,
 * either because it doesn't exist or cannot be read.
 * 
 * @example
 * ```typescript
 * // This would throw ImportError if missing.gzs doesn't exist
 * // <import missing from="./missing.gzs" />
 * ```
 */
export class ImportError extends ZephyrError {
    /**
     * Creates a new ImportError.
     * 
     * @param message - Description of the import error
     * @param file - Optional file path that failed to import
     */
    constructor(message: string, file?: string) {
        super(message, "IMPORT_ERROR", file ? { file, line: 0, column: 0 } : undefined);
        this.name = "ImportError";
    }
}

/**
 * Error thrown when circular imports are detected.
 * 
 * This error indicates that component A imports component B,
 * which (directly or indirectly) imports component A again.
 * 
 * @example
 * ```typescript
 * // a.gzs: <import b from="./b.gzs" />
 * // b.gzs: <import a from="./a.gzs" />
 * // This would throw CircularImportError with chain: ["a.gzs", "b.gzs", "a.gzs"]
 * ```
 */
export class CircularImportError extends ImportError {
    /**
     * Creates a new CircularImportError.
     * 
     * @param chain - Array of file paths showing the circular import chain
     */
    constructor(public readonly chain: string[]) {
        super(`Circular import detected: ${chain.join(" → ")}`);
        this.name = "CircularImportError";
    }
}

/**
 * Error thrown when maximum render depth is exceeded.
 * 
 * This error indicates that component nesting has exceeded the
 * configured maximum depth, which usually indicates infinite
 * component recursion.
 * 
 * @example
 * ```typescript
 * // A component that renders itself would eventually throw this:
 * // <import self from="./self.gzs" />
 * // <template><self /></template>
 * ```
 */
export class MaxDepthError extends RenderError {
    /**
     * Creates a new MaxDepthError.
     * 
     * @param depth - The maximum depth that was exceeded
     * @param component - Optional component file path where the error occurred
     */
    constructor(depth: number, component?: string) {
        super(`Maximum render depth (${depth}) exceeded. Possible infinite component recursion.`, component);
        this.name = "MaxDepthError";
    }
}
