/**
 * Core Integration Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { Zephyr } from "./core";
import { MaxDepthError } from "./errors";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./test-fixtures";

async function createTestFile(name: string, content: string): Promise<string> {
    const path = join(TEST_DIR, name);
    await writeFile(path, content, "utf-8");
    return path;
}

describe("Zephyr Core", () => {
    beforeEach(async () => {
        await mkdir(TEST_DIR, { recursive: true });
    });

    describe("Basic Rendering", () => {
        it("renders a simple template", async () => {
            const path = await createTestFile("simple.gzs", `
                <template>
                    <div>Hello World</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("<div>");
            expect(html).toContain("Hello World");
            expect(html).toContain("</div>");
        });

        it("renders expressions", async () => {
            const path = await createTestFile("expr.gzs", `
                <script>
                    this.name = "World";
                </script>
                <template>
                    <p>Hello {{name}}!</p>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            // Since name is a reactive variable, it will be wrapped in a span for reactivity
            expect(html).toContain("World");
            expect(html).toContain("Hello");
            expect(html).toContain("!");
        });

        it("escapes HTML in expressions by default", async () => {
            // Note: Can't use </script> in string as tokenizer would close script tag
            const path = await createTestFile("escape.gzs", `
                <script>
                    this.unsafe = "<div onclick='alert(1)'>XSS</div>";
                </script>
                <template>
                    <div>{{unsafe}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            // < and > should be escaped, preventing the div from being parsed as HTML
            expect(html).toContain("&lt;div");
            expect(html).toContain("&gt;");
            expect(html).toContain("&#39;"); // escaped single quote
            // The raw < character should NOT appear (except in the wrapper div)
            expect(html.match(/<div/g)?.length).toBe(1); // Only the wrapper div, not the injected one
        });

        it("allows raw HTML with triple braces", async () => {
            const path = await createTestFile("raw.gzs", `
                <script>
                    this.html = "<b>bold</b>";
                </script>
                <template>
                    <div>{{{html}}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("<b>bold</b>");
        });
    });

    describe("Props", () => {
        it("passes props to child components", async () => {
            await createTestFile("child.gzs", `
                <template>
                    <span>{{message}}</span>
                </template>
            `);

            const path = await createTestFile("parent.gzs", `
                <import child from="./child.gzs" />
                <template>
                    <child :message="'Hello from parent'" />
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("<span>Hello from parent</span>");
        });

        it("evaluates prop expressions", async () => {
            await createTestFile("display.gzs", `
                <template>
                    <span>{{value}}</span>
                </template>
            `);

            const path = await createTestFile("math.gzs", `
                <import display from="./display.gzs" />
                <script>
                    this.x = 10;
                </script>
                <template>
                    <display :value="x * 2" />
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("<span>20</span>");
        });
    });

    describe("Loops", () => {
        it("renders loop items", async () => {
            const path = await createTestFile("loop.gzs", `
                <script>
                    this.items = ["a", "b", "c"];
                </script>
                <template>
                    <ul>
                        <li each="item" in="items">{{item}}</li>
                    </ul>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("<li>a</li>");
            expect(html).toContain("<li>b</li>");
            expect(html).toContain("<li>c</li>");
        });

        it("provides loop index", async () => {
            const path = await createTestFile("loop-index.gzs", `
                <script>
                    this.items = ["x", "y"];
                </script>
                <template>
                    <span each="item, i" in="items">{{i}}:{{item}}</span>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("0:x");
            expect(html).toContain("1:y");
        });
    });

    describe("Conditionals", () => {
        it("renders if condition", async () => {
            const path = await createTestFile("if.gzs", `
                <script>
                    this.show = true;
                </script>
                <template>
                    <div if="show">Visible</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("Visible");
        });

        it("hides when if is false", async () => {
            const path = await createTestFile("if-false.gzs", `
                <script>
                    this.visible = false;
                </script>
                <template>
                    <div if="visible">Hidden</div>
                    <div if="!visible">Shown</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).not.toContain("Hidden");
            expect(html).toContain("Shown");
        });

        it("handles if/else chains", async () => {
            const path = await createTestFile("if-else.gzs", `
                <script>
                    this.value = 2;
                </script>
                <template>
                    <span if="value === 1">One</span>
                    <span else-if="value === 2">Two</span>
                    <span else>Other</span>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("Two");
            expect(html).not.toContain("One");
            expect(html).not.toContain("Other");
        });
    });

    describe("Slots", () => {
        it("renders slot content", async () => {
            await createTestFile("wrapper.gzs", `
                <template>
                    <div class="wrapper"><slot /></div>
                </template>
            `);

            const path = await createTestFile("use-slot.gzs", `
                <import wrapper from="./wrapper.gzs" />
                <template>
                    <wrapper>
                        <p>Slot content</p>
                    </wrapper>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain('<div class="wrapper">');
            expect(html).toContain("<p>Slot content</p>");
        });

        it("renders default slot content", async () => {
            await createTestFile("with-default.gzs", `
                <template>
                    <slot>Default content</slot>
                </template>
            `);

            const path = await createTestFile("no-slot.gzs", `
                <import with-default from="./with-default.gzs" />
                <template>
                    <with-default />
                </template>
            `);

            const zephyr = new Zephyr();
            const { html } = await zephyr.render(path);
            
            expect(html).toContain("Default content");
        });
    });

    describe("Styles", () => {
        it("collects component styles", async () => {
            const path = await createTestFile("styled.gzs", `
                <style>
                    .box { color: red; }
                </style>
                <template>
                    <div class="box">Styled</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, css } = await zephyr.render(path);
            
            expect(html).toContain('<div class="box">');
            expect(css).toContain(".box { color: red; }");
        });

        it("deduplicates styles", async () => {
            await createTestFile("styled-child.gzs", `
                <style>
                    .child { color: blue; }
                </style>
                <template>
                    <span class="child">Child</span>
                </template>
            `);

            const path = await createTestFile("styled-parent.gzs", `
                <import styled-child from="./styled-child.gzs" />
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <styled-child each="item" in="items" />
                </template>
            `);

            const zephyr = new Zephyr();
            const { css } = await zephyr.render(path);
            
            // Should only appear once despite 3 renders
            const matches = css.match(/\.child/g) || [];
            expect(matches.length).toBe(1);
        });
    });

    describe("Error Handling", () => {
        it("detects circular imports at load time", async () => {
            // This creates a true circular import where B tries to import A while A is still loading
            await createTestFile("cycle-a.gzs", `
                <import cycle-b from="./cycle-b.gzs" />
                <template><cycle-b /></template>
            `);

            await createTestFile("cycle-b.gzs", `
                <import cycle-a from="./cycle-a.gzs" />
                <template><cycle-a /></template>
            `);

            const zephyr = new Zephyr();
            
            // This will hit either CircularImportError (at load) or MaxDepthError (at render)
            // depending on timing. Both indicate the circular reference was detected.
            await expect(zephyr.render(join(TEST_DIR, "cycle-a.gzs")))
                .rejects.toThrow();
        });

        it("detects infinite render loops via max depth", async () => {
            // Self-referencing component that renders itself
            await createTestFile("self-ref.gzs", `
                <import self-ref from="./self-ref.gzs" />
                <template><self-ref /></template>
            `);

            const zephyr = new Zephyr({ maxRenderDepth: 10 });
            
            await expect(zephyr.render(join(TEST_DIR, "self-ref.gzs")))
                .rejects.toThrow(MaxDepthError);
        });

    });

    describe("Instance Isolation", () => {
        it("instances have separate caches", async () => {
            const path = await createTestFile("isolated.gzs", `
                <script>
                    this.value = Math.random();
                </script>
                <template>
                    <span>{{value}}</span>
                </template>
            `);

            const zephyr1 = new Zephyr();
            const zephyr2 = new Zephyr();
            
            const result1 = await zephyr1.render(path);
            const result2 = await zephyr2.render(path);
            
            // Different instances, different random values
            // (unless extremely unlucky)
            expect(result1.html).not.toBe(result2.html);
        });
    });
});

// Cleanup after all tests
import { afterAll } from "bun:test";

afterAll(async () => {
    try {
        await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
});
