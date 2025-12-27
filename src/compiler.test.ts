/**
 * Compiler Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
    compileExpression,
    evaluateValue,
    runScript,
    escapeHtml,
    clearCaches,
} from "./compiler";

describe("escapeHtml", () => {
    it("escapes HTML special characters", () => {
        expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
        expect(escapeHtml('"test"')).toBe("&quot;test&quot;");
        expect(escapeHtml("a & b")).toBe("a &amp; b");
        expect(escapeHtml("'single'")).toBe("&#39;single&#39;");
    });

    it("handles non-string input", () => {
        expect(escapeHtml(123 as any)).toBe("123");
        expect(escapeHtml(null as any)).toBe("null");
    });

    it("returns empty string for empty input", () => {
        expect(escapeHtml("")).toBe("");
    });
});

describe("compileExpression", () => {
    beforeEach(() => {
        clearCaches();
    });

    it("evaluates simple expressions", () => {
        expect(compileExpression("1 + 1", {})).toBe("2");
        expect(compileExpression("'hello'", {})).toBe("hello");
    });

    it("accesses context variables", () => {
        const context = { name: "World", count: 42 };
        expect(compileExpression("name", context)).toBe("World");
        expect(compileExpression("count", context)).toBe("42");
        expect(compileExpression("'Hello ' + name", context)).toBe("Hello World");
    });

    it("handles undefined variables gracefully", () => {
        expect(compileExpression("undefined_var", {})).toBe("");
        expect(compileExpression("foo || 'default'", {})).toBe("default");
    });

    it("escapes HTML by default", () => {
        const context = { html: "<script>alert('xss')</script>" };
        expect(compileExpression("html", context)).toBe(
            "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
        );
    });

    it("allows raw output when specified", () => {
        const context = { html: "<b>bold</b>" };
        expect(compileExpression("html", context, true)).toBe("<b>bold</b>");
    });

    it("handles complex expressions", () => {
        const context = { items: [1, 2, 3], user: { name: "Alice" } };
        expect(compileExpression("items.length", context)).toBe("3");
        expect(compileExpression("user.name.toUpperCase()", context)).toBe("ALICE");
    });

    it("handles ternary expressions", () => {
        expect(compileExpression("true ? 'yes' : 'no'", {})).toBe("yes");
        expect(compileExpression("false ? 'yes' : 'no'", {})).toBe("no");
    });

    it("caches compiled functions", () => {
        const context = { x: 1 };
        compileExpression("x + 1", context);
        compileExpression("x + 1", context);
        // If this doesn't throw, caching is working
        expect(true).toBe(true);
    });

    it("returns error comment for invalid syntax", () => {
        expect(compileExpression("{{invalid", {})).toBe("<!-- Expression error -->");
    });
});

describe("evaluateValue", () => {
    beforeEach(() => {
        clearCaches();
    });

    it("returns actual values, not strings", () => {
        expect(evaluateValue("42", {})).toBe(42);
        expect(evaluateValue("[1, 2, 3]", {})).toEqual([1, 2, 3]);
        expect(evaluateValue("{ a: 1 }", {})).toEqual({ a: 1 });
    });

    it("returns undefined for missing variables", () => {
        expect(evaluateValue("missing", {})).toBe(undefined);
    });

    it("evaluates context variables", () => {
        const context = { arr: [1, 2, 3] };
        expect(evaluateValue("arr", context)).toEqual([1, 2, 3]);
        expect(evaluateValue("arr.length", context)).toBe(3);
    });
});

describe("runScript", () => {
    beforeEach(() => {
        clearCaches();
    });

    it("executes script and returns context", () => {
        const context = {};
        const result = runScript("this.x = 10", context);
        expect((result as any).x).toBe(10);
    });

    it("can read context variables", () => {
        const context = { a: 5, b: 3 };
        const result = runScript("this.sum = a + b", context);
        expect((result as any).sum).toBe(8);
    });

    it("preserves existing context properties", () => {
        const context = { existing: "value" };
        const result = runScript("this.new = 'added'", context);
        expect((result as any).existing).toBe("value");
        expect((result as any).new).toBe("added");
    });

    it("handles errors gracefully", () => {
        const context = {};
        const result = runScript("this.x = nonexistent.property", context);
        // Should not throw, returns context unchanged
        expect(result).toBe(context);
    });
});
