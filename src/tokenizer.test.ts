/**
 * Tokenizer Tests
 */

import { describe, it, expect } from "bun:test";
import { Tokenizer, TokenType, TokenizerError } from "./tokenizer";

describe("Tokenizer", () => {
    describe("Basic Structure", () => {
        it("tokenizes empty input", () => {
            const tokenizer = new Tokenizer("");
            const tokens = tokenizer.tokenize();
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe(TokenType.EOF);
        });

        it("tokenizes imports", () => {
            const tokenizer = new Tokenizer('<import button from="./button.gzs" />');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.IMPORT_NAME && t.value === "button")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.IMPORT_PATH && t.value === "./button.gzs")).toBe(true);
        });

        it("tokenizes script section", () => {
            const tokenizer = new Tokenizer('<script>this.x = 1;</script>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.SCRIPT_START)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.SCRIPT_CONTENT && t.value.includes("this.x = 1"))).toBe(true);
            expect(tokens.some(t => t.type === TokenType.SCRIPT_END)).toBe(true);
        });

        it("tokenizes style section", () => {
            const tokenizer = new Tokenizer('<style>.box { color: red; }</style>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.STYLE_START)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.STYLE_CONTENT && t.value.includes(".box"))).toBe(true);
            expect(tokens.some(t => t.type === TokenType.STYLE_END)).toBe(true);
        });

        it("tokenizes template section", () => {
            const tokenizer = new Tokenizer('<template><div>Hello</div></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.TEMPLATE_START)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TAG_OPEN && t.value === "div")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TEXT && t.value.includes("Hello"))).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TEMPLATE_END)).toBe(true);
        });
    });

    describe("Template Content", () => {
        it("tokenizes interpolations", () => {
            const tokenizer = new Tokenizer('<template>{{name}}</template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.INTERPOLATION && t.value === "name")).toBe(true);
        });

        it("tokenizes raw interpolations", () => {
            const tokenizer = new Tokenizer('<template>{{{html}}}</template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.INTERPOLATION_RAW && t.value === "html")).toBe(true);
        });

        it("tokenizes self-closing tags", () => {
            const tokenizer = new Tokenizer('<template><input /></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.TAG_OPEN && t.value === "input")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TAG_SELF_CLOSE)).toBe(true);
        });

        it("tokenizes attributes", () => {
            const tokenizer = new Tokenizer('<template><div class="box" id="main"></div></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.ATTR_NAME && t.value === "class")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.ATTR_VALUE && t.value === "box")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.ATTR_NAME && t.value === "id")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.ATTR_VALUE && t.value === "main")).toBe(true);
        });

        it("tokenizes prop bindings", () => {
            const tokenizer = new Tokenizer('<template><comp :name="value" /></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.PROP_NAME && t.value === "name")).toBe(true);
            expect(tokens.some(t => t.type === TokenType.ATTR_VALUE && t.value === "value")).toBe(true);
        });

        it("tokenizes boolean attributes", () => {
            const tokenizer = new Tokenizer('<template><input disabled /></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.ATTR_NAME && t.value === "disabled")).toBe(true);
        });
    });

    describe("Comments", () => {
        it("skips HTML comments", () => {
            const tokenizer = new Tokenizer('<template><!-- comment --><div></div></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.value.includes("comment"))).toBe(false);
            expect(tokens.some(t => t.type === TokenType.TAG_OPEN && t.value === "div")).toBe(true);
        });

        it("skips multi-line comments", () => {
            const tokenizer = new Tokenizer(`<template>
                <!-- 
                    multi-line
                    comment
                -->
                <div></div>
            </template>`);
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.value.includes("multi-line"))).toBe(false);
        });
    });

    describe("Error Handling", () => {
        it("throws on unclosed script tag", () => {
            const tokenizer = new Tokenizer('<script>this.x = 1;');
            expect(() => tokenizer.tokenize()).toThrow(TokenizerError);
        });

        it("throws on unclosed style tag", () => {
            const tokenizer = new Tokenizer('<style>.box {}');
            expect(() => tokenizer.tokenize()).toThrow(TokenizerError);
        });

        it("throws on unclosed template tag", () => {
            const tokenizer = new Tokenizer('<template><div>');
            expect(() => tokenizer.tokenize()).toThrow(TokenizerError);
        });

        it("provides line and column in errors", () => {
            const tokenizer = new Tokenizer('<import from="test" />');
            try {
                tokenizer.tokenize();
                expect(true).toBe(false); // Should not reach
            } catch (e) {
                expect(e).toBeInstanceOf(TokenizerError);
                expect((e as TokenizerError).line).toBe(1);
            }
        });
    });

    describe("Line Tracking", () => {
        it("tracks line numbers correctly", () => {
            const tokenizer = new Tokenizer(`
<script>
    this.x = 1;
</script>
`);
            const tokens = tokenizer.tokenize();
            const scriptStart = tokens.find(t => t.type === TokenType.SCRIPT_START);
            
            expect(scriptStart?.line).toBe(2);
        });
    });

    describe("Edge Cases", () => {
        it("handles empty template", () => {
            const tokenizer = new Tokenizer('<template></template>');
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.TEMPLATE_START)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TEMPLATE_END)).toBe(true);
        });

        it("handles whitespace-only content", () => {
            const tokenizer = new Tokenizer('<template>   \n   </template>');
            const tokens = tokenizer.tokenize();
            
            // No TEXT token for whitespace-only content
            expect(tokens.filter(t => t.type === TokenType.TEXT)).toHaveLength(0);
        });

        it("handles nested quotes in attributes", () => {
            const tokenizer = new Tokenizer(`<template><div title='Say "hello"'></div></template>`);
            const tokens = tokenizer.tokenize();
            
            expect(tokens.some(t => t.type === TokenType.ATTR_VALUE && t.value === 'Say "hello"')).toBe(true);
        });
    });
});
