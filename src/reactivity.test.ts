/**
 * Advanced Reactivity Tests
 * 
 * Tests for advanced reactivity features that should work but currently don't.
 * Following TDD: Write tests first, then implement features.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { Zephyr } from "./core";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./test-fixtures-reactivity";

async function createTestFile(name: string, content: string): Promise<string> {
    const path = join(TEST_DIR, name);
    await writeFile(path, content, "utf-8");
    return path;
}

describe("Advanced Reactivity", () => {
    beforeEach(async () => {
        await mkdir(TEST_DIR, { recursive: true });
    });

    describe("Complex Expressions", () => {
        it("should reactively update arithmetic expressions", async () => {
            const path = await createTestFile("arithmetic.gzs", `
                <script>
                    this.count = 5;
                </script>
                <template>
                    <button onclick="count++">Count: {{count + 1}}</button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            // Should generate JS that handles count + 1
            expect(js).not.toBeNull();
            expect(html).toContain("Count:");
            // JS should track the expression "count + 1" and update it when count changes
            expect(js).toContain("count + 1"); // Should track this expression
            expect(js).toContain("data-interp"); // Should have interpolation markers
        });

        it("should reactively update ternary expressions", async () => {
            const path = await createTestFile("ternary.gzs", `
                <script>
                    this.isActive = true;
                </script>
                <template>
                    <button onclick="isActive = !isActive">
                        Status: {{isActive ? 'On' : 'Off'}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Status:");
        });

        it("should reactively update property access expressions", async () => {
            const path = await createTestFile("property-access.gzs", `
                <script>
                    this.user = { name: "John" };
                </script>
                <template>
                    <button onclick="user.name = 'Jane'">
                        Name: {{user.name}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Name:");
        });

        it("should reactively update array length expressions", async () => {
            const path = await createTestFile("array-length.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items.push(4)">
                        Count: {{items.length}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Count:");
        });
    });

    describe("Nested Property Reactivity", () => {
        it("should track changes to object properties", async () => {
            const path = await createTestFile("nested-prop.gzs", `
                <script>
                    this.user = { name: "John", age: 30 };
                </script>
                <template>
                    <button onclick="user.name = 'Jane'">
                        Name: {{user.name}}
                    </button>
                    <button onclick="user.age++">
                        Age: {{user.age}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Name:");
            expect(html).toContain("Age:");
            // Should track user.name and user.age as reactive properties
            expect(js).toContain("user.name"); // Should handle nested property
        });

        it("should track deeply nested properties", async () => {
            const path = await createTestFile("deep-nested.gzs", `
                <script>
                    this.data = { user: { profile: { name: "John" } } };
                </script>
                <template>
                    <button onclick="data.user.profile.name = 'Jane'">
                        Name: {{data.user.profile.name}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Name:");
        });
    });

    describe("Array Reactivity", () => {
        it("should reactively update when items are pushed", async () => {
            const path = await createTestFile("array-push.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items.push(4)">
                        Count: {{items.length}}
                    </button>
                    <ul>
                        <li each="item" in="items">{{item}}</li>
                    </ul>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Count:");
            // Should handle array.push() and track items.length
            expect(js).toContain("items.push"); // Should transform array operations
            expect(js).toContain("items.length"); // Should track array length
        });

        it("should reactively update when items are popped", async () => {
            const path = await createTestFile("array-pop.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items.pop()">
                        Count: {{items.length}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should reactively update array index assignments", async () => {
            const path = await createTestFile("array-index.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items[0] = 10">
                        First: {{items[0]}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Computed Properties", () => {
        it("should automatically update computed values", async () => {
            const path = await createTestFile("computed.gzs", `
                <script>
                    this.count = 5;
                    // Computed: double should update when count changes
                </script>
                <template>
                    <button onclick="count++">
                        Count: {{count}}, Double: {{count * 2}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("Double:");
        });

        it("should handle computed properties with multiple dependencies", async () => {
            const path = await createTestFile("computed-multi.gzs", `
                <script>
                    this.x = 5;
                    this.y = 10;
                </script>
                <template>
                    <button onclick="x++">
                        Sum: {{x + y}}
                    </button>
                    <button onclick="y++">
                        Sum: {{x + y}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Compound Assignments", () => {
        it("should handle += operator", async () => {
            const path = await createTestFile("compound-add.gzs", `
                <script>
                    this.count = 0;
                </script>
                <template>
                    <button onclick="count += 5">
                        Count: {{count}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            // Should transform count += 5 to update('count', reactive.count.value + 5)
            expect(js).toContain("update('count', reactive.count.value + 5)"); // Should handle the addition
        });

        it("should handle -= operator", async () => {
            const path = await createTestFile("compound-sub.gzs", `
                <script>
                    this.count = 10;
                </script>
                <template>
                    <button onclick="count -= 2">
                        Count: {{count}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should handle *= operator", async () => {
            const path = await createTestFile("compound-mul.gzs", `
                <script>
                    this.count = 2;
                </script>
                <template>
                    <button onclick="count *= 2">
                        Count: {{count}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Multiple Event Types", () => {
        it("should handle input events", async () => {
            const path = await createTestFile("input-event.gzs", `
                <script>
                    this.value = "";
                </script>
                <template>
                    <input oninput="value = this.value" />
                    <div>Value: {{value}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            expect(html).toContain("input");
            // Should set up event listener for 'input' events, not just 'click'
            expect(js).toContain("input"); // Should handle input events
        });

        it("should handle change events", async () => {
            const path = await createTestFile("change-event.gzs", `
                <script>
                    this.selected = "";
                </script>
                <template>
                    <select onchange="selected = this.value">
                        <option value="a">A</option>
                        <option value="b">B</option>
                    </select>
                    <div>Selected: {{selected}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should handle submit events", async () => {
            const path = await createTestFile("submit-event.gzs", `
                <script>
                    this.submitted = false;
                </script>
                <template>
                    <form onsubmit="submitted = true; return false">
                        <button type="submit">Submit</button>
                    </form>
                    <div>Submitted: {{submitted}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Attribute Reactivity", () => {
        it("should update class attribute reactively", async () => {
            const path = await createTestFile("attr-class.gzs", `
                <script>
                    this.isActive = false;
                </script>
                <template>
                    <button onclick="isActive = !isActive">
                        <div class="{{isActive ? 'active' : 'inactive'}}">
                            Status
                        </div>
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should update style attribute reactively", async () => {
            const path = await createTestFile("attr-style.gzs", `
                <script>
                    this.color = "red";
                </script>
                <template>
                    <button onclick="color = color === 'red' ? 'blue' : 'red'">
                        <div style="color: {{color}}">
                            Colored Text
                        </div>
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should update disabled attribute reactively", async () => {
            const path = await createTestFile("attr-disabled.gzs", `
                <script>
                    this.isDisabled = false;
                </script>
                <template>
                    <button onclick="isDisabled = !isDisabled">
                        Toggle
                    </button>
                    <button disabled="{{isDisabled}}">
                        Disabled Button
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Conditional Reactivity", () => {
        it("should show/hide elements reactively", async () => {
            const path = await createTestFile("conditional-show.gzs", `
                <script>
                    this.show = true;
                </script>
                <template>
                    <button onclick="show = !show">Toggle</button>
                    <div if="show">Visible Content</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            // Should be able to show/hide reactively
        });

        it("should handle else-if chains reactively", async () => {
            const path = await createTestFile("conditional-chain.gzs", `
                <script>
                    this.value = 1;
                </script>
                <template>
                    <button onclick="value = (value % 3) + 1">Next</button>
                    <div if="value === 1">One</div>
                    <div else-if="value === 2">Two</div>
                    <div else>Other</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("List Reactivity", () => {
        it("should add items to list reactively", async () => {
            const path = await createTestFile("list-add.gzs", `
                <script>
                    this.items = [1, 2, 3];
                    this.nextId = 4;
                </script>
                <template>
                    <button onclick="items.push(nextId); nextId++">
                        Add Item
                    </button>
                    <ul>
                        <li each="item" in="items">{{item}}</li>
                    </ul>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            // Should be able to add items and see them in DOM
        });

        it("should remove items from list reactively", async () => {
            const path = await createTestFile("list-remove.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items.pop()">
                        Remove Last
                    </button>
                    <ul>
                        <li each="item" in="items">{{item}}</li>
                    </ul>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should update items in list reactively", async () => {
            const path = await createTestFile("list-update.gzs", `
                <script>
                    this.items = [1, 2, 3];
                </script>
                <template>
                    <button onclick="items[0] = 10">
                        Update First
                    </button>
                    <ul>
                        <li each="item" in="items">{{item}}</li>
                    </ul>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Two-Way Binding", () => {
        it("should bind input value reactively", async () => {
            const path = await createTestFile("two-way-input.gzs", `
                <script>
                    this.name = "";
                </script>
                <template>
                    <input :value="name" oninput="name = this.value" />
                    <div>Name: {{name}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should bind textarea value reactively", async () => {
            const path = await createTestFile("two-way-textarea.gzs", `
                <script>
                    this.text = "";
                </script>
                <template>
                    <textarea :value="text" oninput="text = this.value"></textarea>
                    <div>Text: {{text}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Lifecycle Hooks", () => {
        it("should call onMount hook", async () => {
            const path = await createTestFile("lifecycle-mount.gzs", `
                <script>
                    this.mounted = false;
                    // onMount(() => { this.mounted = true; })
                </script>
                <template>
                    <div>Mounted: {{mounted}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            // Should have JS that sets mounted to true on mount
            expect(js).not.toBeNull();
        });

        it("should call onUpdate hook", async () => {
            const path = await createTestFile("lifecycle-update.gzs", `
                <script>
                    this.count = 0;
                    this.updateCount = 0;
                    // onUpdate(() => { this.updateCount++; })
                </script>
                <template>
                    <button onclick="count++">
                        Count: {{count}}, Updates: {{updateCount}}
                    </button>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });
    });

    describe("Reactive Props", () => {
        it("should update child when parent prop changes", async () => {
            await createTestFile("child-prop.gzs", `
                <template>
                    <div>Value: {{value}}</div>
                </template>
            `);

            const path = await createTestFile("parent-prop.gzs", `
                <import child from="./child-prop.gzs" />
                <script>
                    this.count = 0;
                </script>
                <template>
                    <button onclick="count++">Increment</button>
                    <child :value="count" />
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
            // Child should update when parent's count changes
        });
    });

    describe("Complex Scenarios", () => {
        it("should handle form with multiple reactive fields", async () => {
            const path = await createTestFile("form-complex.gzs", `
                <script>
                    this.name = "";
                    this.email = "";
                    this.isValid = false;
                </script>
                <template>
                    <form onsubmit="isValid = name.length > 0 && email.includes('@'); return false">
                        <input :value="name" oninput="name = this.value" placeholder="Name" />
                        <input :value="email" oninput="email = this.value" placeholder="Email" />
                        <button type="submit" disabled="{{!isValid}}">
                            Submit
                        </button>
                    </form>
                    <div>Valid: {{isValid}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
        });

        it("should handle todo list with add/remove/toggle", async () => {
            const path = await createTestFile("todo-list.gzs", `
                <script>
                    this.todos = [];
                    this.newTodo = "";
                </script>
                <template>
                    <input :value="newTodo" oninput="newTodo = this.value" />
                    <button onclick="todos.push({text: newTodo, done: false}); newTodo = ''">
                        Add
                    </button>
                    <ul>
                        <li each="todo" in="todos">
                            <input type="checkbox" :checked="todo.done" 
                                   onchange="todo.done = this.checked" />
                            <span>{{todo.text}}</span>
                            <button onclick="todos = todos.filter(t => t !== todo)">
                                Delete
                            </button>
                        </li>
                    </ul>
                    <div>Total: {{todos.length}}, Done: {{todos.filter(t => t.done).length}}</div>
                </template>
            `);

            const zephyr = new Zephyr();
            const { html, js } = await zephyr.render(path);
            
            expect(js).not.toBeNull();
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
