import { Token, TokenType, Tokenizer } from "./tokenizer";

// AST Node Types
export interface ImportNode {
    type: "import";
    name: string;
    path: string;
}

export interface ScriptNode {
    type: "script";
    code: string;
}

export interface StyleNode {
    type: "style";
    css: string;
}

export interface AttributeValue {
    value: string;
    hasRawInterpolation: boolean;
}

export interface ElementNode {
    type: "element";
    tag: string;
    attributes: Map<string, AttributeValue>;  // Static attributes with raw flag
    props: Map<string, string>;               // Bound props (:name="expr")
    children: TemplateChild[];
    selfClosing: boolean;
    loop?: { item: string; index?: string; array: string };
    conditional?: { 
        type: "if" | "else-if" | "else"; 
        expression?: string;  // undefined for 'else'
    };
}

export interface TextNode {
    type: "text";
    value: string;
}

export interface InterpolationNode {
    type: "interpolation";
    expression: string;
    raw: boolean; // If true, output raw HTML (no escaping)
}

export type TemplateChild = ElementNode | TextNode | InterpolationNode;

export interface ComponentAST {
    imports: ImportNode[];
    script: ScriptNode | null;
    style: StyleNode | null;
    template: TemplateChild[];
}

export class Parser {
    private pos = 0;
    private tokens: Token[] = [];
    
    /**
     * Parse from source string (tokenizes internally)
     */
    parse(input: string): ComponentAST {
        const tokenizer = new Tokenizer(input);
        return this.parseTokens(tokenizer.tokenize());
    }
    
    /**
     * Parse from pre-tokenized tokens (avoids double tokenization)
     */
    parseTokens(tokens: Token[]): ComponentAST {
        this.tokens = tokens;
        this.pos = 0;
        
        const ast: ComponentAST = {
            imports: [],
            script: null,
            style: null,
            template: [],
        };
        
        while (!this.isAtEnd()) {
            const token = this.current();
            
            if (token.type === TokenType.IMPORT_NAME) {
                ast.imports.push(this.parseImport());
            } else if (token.type === TokenType.SCRIPT_START) {
                ast.script = this.parseScript();
            } else if (token.type === TokenType.STYLE_START) {
                ast.style = this.parseStyle();
            } else if (token.type === TokenType.TEMPLATE_START) {
                ast.template = this.parseTemplate();
            } else {
                this.advance();
            }
        }
        
        return ast;
    }
    
    private parseImport(): ImportNode {
        // Consume IMPORT_NAME token
        const nameToken = this.consume(TokenType.IMPORT_NAME);
        
        // Consume IMPORT_PATH token
        const pathToken = this.consume(TokenType.IMPORT_PATH);
        
        return {
            type: "import",
            name: nameToken.value,
            path: pathToken.value,
        };
    }
    
    private parseScript(): ScriptNode {
        this.consume(TokenType.SCRIPT_START);
        const content = this.consume(TokenType.SCRIPT_CONTENT);
        this.consume(TokenType.SCRIPT_END);
        
        return {
            type: "script",
            code: content.value,
        };
    }
    
    private parseStyle(): StyleNode {
        this.consume(TokenType.STYLE_START);
        const content = this.consume(TokenType.STYLE_CONTENT);
        this.consume(TokenType.STYLE_END);
        
        return {
            type: "style",
            css: content.value,
        };
    }
    
    private parseTemplate(): TemplateChild[] {
        this.consume(TokenType.TEMPLATE_START);
        
        const children: TemplateChild[] = [];
        
        while (!this.check(TokenType.TEMPLATE_END) && !this.isAtEnd()) {
            const child = this.parseTemplateChild();
            if (child) children.push(child);
        }
        
        this.consume(TokenType.TEMPLATE_END);
        return children;
    }
    
    private parseTemplateChild(): TemplateChild | null {
        const token = this.current();
        
        switch (token.type) {
            case TokenType.TAG_OPEN:
                return this.parseElement();
            case TokenType.TEXT:
                this.advance();
                return { type: "text", value: token.value };
            case TokenType.INTERPOLATION:
                this.advance();
                return { type: "interpolation", expression: token.value, raw: false };
            case TokenType.INTERPOLATION_RAW:
                this.advance();
                return { type: "interpolation", expression: token.value, raw: true };
            case TokenType.TAG_END:
                return null; // Will be handled by parent
            default:
                this.advance();
                return null;
        }
    }
    
    private parseElement(): ElementNode {
        const tagToken = this.consume(TokenType.TAG_OPEN);
        const tag = tagToken.value;
        const attributes = new Map<string, AttributeValue>();
        const props = new Map<string, string>();
        let loop: ElementNode["loop"] = undefined;
        
        // Parse attributes and props
        while (this.check(TokenType.ATTR_NAME) || this.check(TokenType.PROP_NAME)) {
            const isProp = this.check(TokenType.PROP_NAME);
            const name = this.advance().value;
            let value = "";
            let hasRawInterpolation = false;
            
            if (this.check(TokenType.ATTR_EQ)) {
                this.advance(); // =
                if (this.check(TokenType.ATTR_VALUE)) {
                    value = this.consume(TokenType.ATTR_VALUE).value;
                    hasRawInterpolation = false;
                } else if (this.check(TokenType.ATTR_VALUE_RAW)) {
                    value = this.consume(TokenType.ATTR_VALUE_RAW).value;
                    hasRawInterpolation = true;
                }
            }
            
            if (isProp) {
                props.set(name, value);
            } else {
                attributes.set(name, { value, hasRawInterpolation });
            }
        }
        
        // Extract loop directives from attributes
        if (attributes.has("each") && attributes.has("in")) {
            const eachAttr = attributes.get("each")!;
            const [item, index] = eachAttr.value.split(",").map(s => s.trim());
            loop = {
                item,
                index: index || undefined,
                array: attributes.get("in")!.value,
            };
            attributes.delete("each");
            attributes.delete("in");
        }
        
        // Extract conditional directives from attributes
        let conditional: ElementNode["conditional"] = undefined;
        if (attributes.has("if")) {
            conditional = {
                type: "if",
                expression: attributes.get("if")!.value,
            };
            attributes.delete("if");
        } else if (attributes.has("else-if")) {
            conditional = {
                type: "else-if",
                expression: attributes.get("else-if")!.value,
            };
            attributes.delete("else-if");
        } else if (attributes.has("else")) {
            conditional = {
                type: "else",
            };
            attributes.delete("else");
        }
        
        // Check for self-closing
        const selfClosing = this.check(TokenType.TAG_SELF_CLOSE);
        if (selfClosing) {
            this.advance(); // />
        } else {
            this.consume(TokenType.TAG_CLOSE); // >
        }
        
        const children: TemplateChild[] = [];
        
        // Parse children if not self-closing
        if (!selfClosing) {
            while (!this.isAtEnd()) {
                if (this.check(TokenType.TAG_END) && this.current().value === tag) {
                    break;
                }
                
                const child = this.parseTemplateChild();
                if (child) children.push(child);
                
                // Safety: break if we hit template end
                if (this.check(TokenType.TEMPLATE_END)) break;
            }
            
            // Consume closing tag
            if (this.check(TokenType.TAG_END)) {
                this.advance();
            }
        }
        
        return {
            type: "element",
            tag,
            attributes,
            props,
            children,
            selfClosing,
            loop,
            conditional,
        };
    }
    
    private current(): Token {
        return this.tokens[this.pos] || { type: TokenType.EOF, value: "", line: 0, col: 0 };
    }
    
    private check(type: TokenType): boolean {
        return this.current().type === type;
    }
    
    private advance(): Token {
        const token = this.current();
        this.pos++;
        return token;
    }
    
    private consume(type: TokenType): Token {
        if (!this.check(type)) {
            throw this.error(`Expected ${type}, got ${this.current().type}`, this.current());
        }
        return this.advance();
    }
    
    private isAtEnd(): boolean {
        return this.current().type === TokenType.EOF;
    }
    
    private error(message: string, token: Token): Error {
        return new Error(`Parse error at line ${token.line}, col ${token.col}: ${message}`);
    }
}

export function parse(input: string): ComponentAST {
    return new Parser().parse(input);
}

export function parseTokens(tokens: Token[]): ComponentAST {
    return new Parser().parseTokens(tokens);
}
