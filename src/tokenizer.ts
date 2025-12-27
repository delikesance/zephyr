export enum TokenType {
    // Structure
    IMPORT_NAME = "IMPORT_NAME",     // import component name
    IMPORT_PATH = "IMPORT_PATH",     // import path
    SCRIPT_START = "SCRIPT_START",
    SCRIPT_END = "SCRIPT_END",
    SCRIPT_CONTENT = "SCRIPT_CONTENT",
    STYLE_START = "STYLE_START",
    STYLE_END = "STYLE_END",
    STYLE_CONTENT = "STYLE_CONTENT",
    TEMPLATE_START = "TEMPLATE_START",
    TEMPLATE_END = "TEMPLATE_END",
    
    // Elements
    TAG_OPEN = "TAG_OPEN",           // <div
    TAG_SELF_CLOSE = "TAG_SELF_CLOSE", // />
    TAG_CLOSE = "TAG_CLOSE",         // >
    TAG_END = "TAG_END",             // </div>
    
    // Attributes
    ATTR_NAME = "ATTR_NAME",         // name
    PROP_NAME = "PROP_NAME",         // :name (bound prop)
    ATTR_EQ = "ATTR_EQ",
    ATTR_VALUE = "ATTR_VALUE",
    ATTR_VALUE_RAW = "ATTR_VALUE_RAW", // Attribute with {{{raw}}} interpolation
    
    // Content
    TEXT = "TEXT",
    INTERPOLATION = "INTERPOLATION",     // {{expr}} - HTML escaped
    INTERPOLATION_RAW = "INTERPOLATION_RAW", // {{{expr}}} - raw HTML
    
    EOF = "EOF",
}

// Error class for tokenizer errors
export class TokenizerError extends Error {
    constructor(message: string, public line: number, public col: number) {
        super(`${message} at line ${line}, col ${col}`);
        this.name = "TokenizerError";
    }
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}

// Pre-computed character codes for fast comparison
const CHAR_LT = 60;        // <
const CHAR_GT = 62;        // >
const CHAR_SLASH = 47;     // /
const CHAR_COLON = 58;     // :
const CHAR_EQ = 61;        // =
const CHAR_QUOTE = 34;     // "
const CHAR_APOS = 39;      // '
const CHAR_LBRACE = 123;   // {
const CHAR_RBRACE = 125;   // }
const CHAR_NEWLINE = 10;   // \n
const CHAR_SPACE = 32;     // space
const CHAR_TAB = 9;        // \t
const CHAR_CR = 13;        // \r
const CHAR_DASH = 45;      // -
const CHAR_BANG = 33;      // !

export class Tokenizer {
    private pos = 0;
    private line = 1;
    private col = 1;
    private tokens: Token[] = [];
    private readonly len: number;
    
    constructor(private readonly input: string) {
        this.len = input.length;
    }
    
    tokenize(): Token[] {
        while (this.pos < this.len) {
            this.skipWhitespaceAndComments();
            if (this.pos >= this.len) break;
            
            if (this.matchStr("<import")) {
                this.tokenizeImport();
            } else if (this.matchStr("<script")) {
                this.tokenizeScript();
            } else if (this.matchStr("<style")) {
                this.tokenizeStyle();
            } else if (this.matchStr("<template")) {
                this.tokenizeTemplate();
            } else {
                this.advance();
            }
        }
        
        this.tokens.push({ type: TokenType.EOF, value: "", line: this.line, col: this.col });
        return this.tokens;
    }
    
    private tokenizeImport() {
        const start = { line: this.line, col: this.col };
        
        // Skip "<import"
        this.advanceN(7);
        this.skipWhitespace();
        
        // Get component name
        const nameStart = this.pos;
        while (this.pos < this.len && this.isTagChar(this.charCode())) {
            this.advance();
        }
        const name = this.input.slice(nameStart, this.pos);
        if (!name) {
            throw new TokenizerError("Expected import name", this.line, this.col);
        }
        this.tokens.push({ type: TokenType.IMPORT_NAME, value: name, ...start });
        
        this.skipWhitespace();
        
        // Expect "from"
        if (!this.matchStr("from")) {
            throw new TokenizerError("Expected 'from' in import", this.line, this.col);
        }
        this.advanceN(4); // "from"
        this.skipWhitespace();
        
        // Handle optional "=" (supports both `from="path"` and `from "path"`)
        if (this.charCode() === CHAR_EQ) {
            this.advance(); // =
            this.skipWhitespace();
        }
        
        // Expect quoted path
        const quoteCode = this.charCode();
        if (quoteCode !== CHAR_QUOTE && quoteCode !== CHAR_APOS) {
            throw new TokenizerError("Expected quoted path in import", this.line, this.col);
        }
        this.advance(); // opening quote
        
        const pathStart = this.pos;
        while (this.pos < this.len && this.charCode() !== quoteCode) {
            this.advance();
        }
        const path = this.input.slice(pathStart, this.pos);
        this.advance(); // closing quote
        
        this.tokens.push({ type: TokenType.IMPORT_PATH, value: path, line: start.line, col: start.col });
        
        this.skipWhitespace();
        
        // Expect /> or >
        if (this.matchChars(CHAR_SLASH, CHAR_GT)) {
            this.advance(); // /
            this.advance(); // >
        } else if (this.charCode() === CHAR_GT) {
            this.advance(); // >
        } else {
            throw new TokenizerError("Expected '/>' or '>' to close import", this.line, this.col);
        }
    }
    
    private tokenizeScript() {
        const start = { line: this.line, col: this.col };
        
        // Skip <script...>
        while (this.pos < this.len && this.charCode() !== CHAR_GT) {
            this.advance();
        }
        if (this.pos >= this.len) {
            throw new TokenizerError("Unclosed <script> tag", start.line, start.col);
        }
        this.advance(); // >
        
        this.tokens.push({ type: TokenType.SCRIPT_START, value: "<script>", ...start });
        
        // Capture content until </script>
        const contentStart = { line: this.line, col: this.col };
        const contentStartPos = this.pos;
        
        while (this.pos < this.len && !this.matchStr("</script>")) {
            this.advance();
        }
        
        if (this.pos >= this.len) {
            throw new TokenizerError("Unclosed <script> tag - missing </script>", start.line, start.col);
        }
        
        const content = this.input.slice(contentStartPos, this.pos);
        this.tokens.push({ type: TokenType.SCRIPT_CONTENT, value: content, ...contentStart });
        
        // Consume </script> using advance() for proper line tracking
        const endStart = { line: this.line, col: this.col };
        this.advanceN(9); // "</script>".length
        this.tokens.push({ type: TokenType.SCRIPT_END, value: "</script>", ...endStart });
    }
    
    private tokenizeStyle() {
        const start = { line: this.line, col: this.col };
        
        // Skip <style...>
        while (this.pos < this.len && this.charCode() !== CHAR_GT) {
            this.advance();
        }
        if (this.pos >= this.len) {
            throw new TokenizerError("Unclosed <style> tag", start.line, start.col);
        }
        this.advance(); // >
        
        this.tokens.push({ type: TokenType.STYLE_START, value: "<style>", ...start });
        
        // Capture content until </style>
        const contentStart = { line: this.line, col: this.col };
        const contentStartPos = this.pos;
        
        while (this.pos < this.len && !this.matchStr("</style>")) {
            this.advance();
        }
        
        if (this.pos >= this.len) {
            throw new TokenizerError("Unclosed <style> tag - missing </style>", start.line, start.col);
        }
        
        const content = this.input.slice(contentStartPos, this.pos);
        this.tokens.push({ type: TokenType.STYLE_CONTENT, value: content, ...contentStart });
        
        // Consume </style> using advance() for proper line tracking
        const endStart = { line: this.line, col: this.col };
        this.advanceN(8); // "</style>".length
        this.tokens.push({ type: TokenType.STYLE_END, value: "</style>", ...endStart });
    }
    
    private tokenizeTemplate() {
        const start = { line: this.line, col: this.col };
        
        // Skip <template...>
        while (this.pos < this.len && this.charCode() !== CHAR_GT) {
            this.advance();
        }
        if (this.pos >= this.len) {
            throw new TokenizerError("Unclosed <template> tag", start.line, start.col);
        }
        this.advance(); // >
        
        this.tokens.push({ type: TokenType.TEMPLATE_START, value: "<template>", ...start });
        
        // Tokenize template content
        this.tokenizeTemplateContent(start);
        
        // Check we found </template>
        if (!this.matchStr("</template>")) {
            throw new TokenizerError("Unclosed <template> tag - missing </template>", start.line, start.col);
        }
        
        // Consume </template> using advance() for proper line tracking
        const endStart = { line: this.line, col: this.col };
        this.advanceN(11); // "</template>".length
        this.tokens.push({ type: TokenType.TEMPLATE_END, value: "</template>", ...endStart });
    }
    
    private tokenizeTemplateContent(templateStart: { line: number; col: number }) {
        while (this.pos < this.len && !this.matchStr("</template>")) {
            const code = this.charCode();
            
            // Skip HTML comments inside template
            if (code === CHAR_LT && 
                this.charCodeAt(1) === CHAR_BANG && 
                this.charCodeAt(2) === CHAR_DASH && 
                this.charCodeAt(3) === CHAR_DASH) {
                this.skipComment();
            } else if (code === CHAR_LBRACE && 
                       this.charCodeAt(1) === CHAR_LBRACE && 
                       this.charCodeAt(2) === CHAR_LBRACE) {
                // Raw interpolation {{{expr}}}
                this.tokenizeInterpolation(true);
            } else if (code === CHAR_LBRACE && this.charCodeAt(1) === CHAR_LBRACE) {
                // Escaped interpolation {{expr}}
                this.tokenizeInterpolation(false);
            } else if (code === CHAR_LT && this.charCodeAt(1) === CHAR_SLASH) {
                this.tokenizeEndTag();
            } else if (code === CHAR_LT) {
                this.tokenizeElement();
            } else {
                this.tokenizeText();
            }
        }
    }
    
    private skipComment() {
        // Skip <!-- using advance() to track lines properly
        this.advance(); // <
        this.advance(); // !
        this.advance(); // -
        this.advance(); // -
        
        // Find -->
        while (this.pos < this.len) {
            if (this.charCode() === CHAR_DASH && 
                this.charCodeAt(1) === CHAR_DASH && 
                this.charCodeAt(2) === CHAR_GT) {
                this.advance(); // -
                this.advance(); // -
                this.advance(); // >
                return;
            }
            this.advance();
        }
    }
    
    private tokenizeInterpolation(raw: boolean) {
        const start = { line: this.line, col: this.col };
        
        if (raw) {
            this.advance(); // {
            this.advance(); // {
            this.advance(); // {
        } else {
            this.advance(); // {
            this.advance(); // {
        }
        
        const exprStart = this.pos;
        
        if (raw) {
            // Find }}}
            while (this.pos < this.len && 
                   !(this.charCode() === CHAR_RBRACE && 
                     this.charCodeAt(1) === CHAR_RBRACE && 
                     this.charCodeAt(2) === CHAR_RBRACE)) {
                this.advance();
            }
        } else {
            // Find }}
            while (this.pos < this.len && !this.matchChars(CHAR_RBRACE, CHAR_RBRACE)) {
                this.advance();
            }
        }
        
        const expr = this.input.slice(exprStart, this.pos).trim();
        
        if (raw) {
            this.advance(); // }
            this.advance(); // }
            this.advance(); // }
            this.tokens.push({ type: TokenType.INTERPOLATION_RAW, value: expr, ...start });
        } else {
            this.advance(); // }
            this.advance(); // }
            this.tokens.push({ type: TokenType.INTERPOLATION, value: expr, ...start });
        }
    }
    
    private tokenizeElement() {
        const start = { line: this.line, col: this.col };
        this.advance(); // <
        
        // Tag name - use slice instead of char-by-char
        const tagStart = this.pos;
        while (this.pos < this.len && this.isTagChar(this.charCode())) {
            this.advance();
        }
        const tagName = this.input.slice(tagStart, this.pos);
        
        this.tokens.push({ type: TokenType.TAG_OPEN, value: tagName, ...start });
        
        // Attributes
        this.tokenizeAttributes();
        
        // Close tag
        this.skipWhitespace();
        if (this.matchChars(CHAR_SLASH, CHAR_GT)) {
            this.tokens.push({ type: TokenType.TAG_SELF_CLOSE, value: "/>", line: this.line, col: this.col });
            this.advance();
            this.advance();
        } else if (this.charCode() === CHAR_GT) {
            this.tokens.push({ type: TokenType.TAG_CLOSE, value: ">", line: this.line, col: this.col });
            this.advance();
        }
    }
    
    private tokenizeAttributes() {
        while (this.pos < this.len) {
            this.skipWhitespace();
            
            const code = this.charCode();
            if (code === CHAR_GT || this.matchChars(CHAR_SLASH, CHAR_GT)) break;
            
            const nameStart = { line: this.line, col: this.col };
            
            // Check for prop binding (:name)
            const isProp = code === CHAR_COLON;
            if (isProp) this.advance();
            
            // Attribute/prop name - use slice
            const attrStart = this.pos;
            while (this.pos < this.len && this.isTagChar(this.charCode())) {
                this.advance();
            }
            const name = this.input.slice(attrStart, this.pos);
            
            if (name) {
                const tokenType = isProp ? TokenType.PROP_NAME : TokenType.ATTR_NAME;
                this.tokens.push({ type: tokenType, value: name, ...nameStart });
                
                this.skipWhitespace();
                
                // Check for =
                if (this.charCode() === CHAR_EQ) {
                    this.tokens.push({ type: TokenType.ATTR_EQ, value: "=", line: this.line, col: this.col });
                    this.advance();
                    this.skipWhitespace();
                    
                    // Attribute value
                    const quoteCode = this.charCode();
                    if (quoteCode === CHAR_QUOTE || quoteCode === CHAR_APOS) {
                        this.advance();
                        
                        const valStart = { line: this.line, col: this.col };
                        const valStartPos = this.pos;
                        
                        // Check if value contains {{{raw}}} interpolation
                        let hasRawInterpolation = false;
                        
                        while (this.pos < this.len && this.charCode() !== quoteCode) {
                            if (this.charCode() === CHAR_LBRACE && 
                                this.charCodeAt(1) === CHAR_LBRACE && 
                                this.charCodeAt(2) === CHAR_LBRACE) {
                                hasRawInterpolation = true;
                            }
                            this.advance();
                        }
                        
                        const value = this.input.slice(valStartPos, this.pos);
                        this.advance(); // closing quote
                        
                        // Use ATTR_VALUE_RAW if contains {{{raw}}}
                        const valueType = hasRawInterpolation ? TokenType.ATTR_VALUE_RAW : TokenType.ATTR_VALUE;
                        this.tokens.push({ type: valueType, value, ...valStart });
                    }
                }
            }
        }
    }
    
    private tokenizeEndTag() {
        const start = { line: this.line, col: this.col };
        this.advance(); // <
        this.advance(); // /
        
        const tagStart = this.pos;
        while (this.pos < this.len && this.isTagChar(this.charCode())) {
            this.advance();
        }
        const tagName = this.input.slice(tagStart, this.pos);
        
        this.skipWhitespace();
        if (this.charCode() === CHAR_GT) this.advance();
        
        this.tokens.push({ type: TokenType.TAG_END, value: tagName, ...start });
    }
    
    private tokenizeText() {
        const start = { line: this.line, col: this.col };
        const textStart = this.pos;
        
        while (this.pos < this.len) {
            const code = this.charCode();
            // Stop at < or {{ or {{{ or </template>
            if (code === CHAR_LT || 
                (code === CHAR_LBRACE && this.charCodeAt(1) === CHAR_LBRACE) ||
                this.matchStr("</template>")) {
                break;
            }
            this.advance();
        }
        
        const text = this.input.slice(textStart, this.pos);
        if (text.trim()) {
            this.tokens.push({ type: TokenType.TEXT, value: text, ...start });
        }
    }
    
    // Optimized character access
    private charCode(): number {
        return this.input.charCodeAt(this.pos);
    }
    
    private charCodeAt(offset: number): number {
        return this.input.charCodeAt(this.pos + offset);
    }
    
    // Check if character is valid for tag/attribute names
    private isTagChar(code: number): boolean {
        return (code >= 65 && code <= 90) ||   // A-Z
               (code >= 97 && code <= 122) ||  // a-z
               (code >= 48 && code <= 57) ||   // 0-9
               code === 95 ||                   // _
               code === CHAR_DASH;              // -
    }
    
    // Check two consecutive characters
    private matchChars(c1: number, c2: number): boolean {
        return this.charCode() === c1 && this.charCodeAt(1) === c2;
    }
    
    // String matching - only for longer strings where charCode comparison isn't practical
    private matchStr(str: string): boolean {
        const len = str.length;
        if (this.pos + len > this.len) return false;
        
        for (let i = 0; i < len; i++) {
            if (this.input.charCodeAt(this.pos + i) !== str.charCodeAt(i)) {
                return false;
            }
        }
        return true;
    }
    
    private advance() {
        if (this.charCode() === CHAR_NEWLINE) {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
    }
    
    // Advance N characters (for known strings like </script>)
    private advanceN(n: number) {
        for (let i = 0; i < n; i++) {
            this.advance();
        }
    }
    
    private skipWhitespace() {
        while (this.pos < this.len) {
            const code = this.charCode();
            if (code === CHAR_SPACE || code === CHAR_TAB || code === CHAR_NEWLINE || code === CHAR_CR) {
                this.advance();
            } else {
                break;
            }
        }
    }
    
    private skipWhitespaceAndComments() {
        while (this.pos < this.len) {
            const code = this.charCode();
            if (code === CHAR_SPACE || code === CHAR_TAB || code === CHAR_NEWLINE || code === CHAR_CR) {
                this.advance();
            } else if (code === CHAR_LT && 
                       this.charCodeAt(1) === CHAR_BANG && 
                       this.charCodeAt(2) === CHAR_DASH && 
                       this.charCodeAt(3) === CHAR_DASH) {
                // Skip HTML comment using advance() to track lines properly
                this.skipComment();
            } else {
                break;
            }
        }
    }
}
