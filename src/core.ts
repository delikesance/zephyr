/**
 * Zephyr Core
 * 
 * Instance-based architecture for the Zephyr templating engine.
 * All state is contained within instances, making it thread-safe and testable.
 */

import { resolve, dirname } from "path";
import { ComponentAST, TemplateChild, ElementNode, AttributeValue, StyleNode } from "./parser";
import { Tokenizer } from "./tokenizer";
import { parseTokens } from "./parser";
import {
    compileExpression,
    evaluateValue,
    runScript,
    escapeHtml,
    clearCaches as clearCompilerCaches,
} from "./compiler";
import { CircularImportError, MaxDepthError, ImportError } from "./errors";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ZephyrConfig {
    /** Maximum component nesting depth (default: 100) */
    maxRenderDepth?: number;
    /** Maximum loop context pool size (default: 20) */
    maxPoolSize?: number;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}

export interface Component extends ComponentAST {
    resolvedImports: Map<string, string>;
    filePath: string;
}

export interface RenderResult {
    html: string;
    css: string;
}

// Use Symbol to prevent collision with user data
const SLOT_CONTENT = Symbol("zephyr.slot");
type RenderContext = Record<string | symbol, any>;

// =============================================================================
// Loop Context Pool
// =============================================================================

class LoopContext {
    private base: object = {};
    private itemKey = "";
    private indexKey?: string;
    private currentItem: any;
    private currentIndex = 0;

    setup(base: object, itemKey: string, indexKey?: string): void {
        this.base = base;
        this.itemKey = itemKey;
        this.indexKey = indexKey;
    }

    update(item: any, index: number): void {
        this.currentItem = item;
        this.currentIndex = index;
    }

    getContext(): RenderContext {
        const ctx: any = Object.create(this.base);
        ctx[this.itemKey] = this.currentItem;
        if (this.indexKey) {
            ctx[this.indexKey] = this.currentIndex;
        }
        if ((this.base as any)[SLOT_CONTENT]) {
            ctx[SLOT_CONTENT] = (this.base as any)[SLOT_CONTENT];
        }
        return ctx;
    }
}

class LoopContextPool {
    private pool: LoopContext[] = [];
    private maxSize: number;

    constructor(maxSize = 20) {
        this.maxSize = maxSize;
    }

    acquire(): LoopContext {
        return this.pool.pop() || new LoopContext();
    }

    release(ctx: LoopContext): void {
        if (this.pool.length < this.maxSize) {
            this.pool.push(ctx);
        }
    }

    clear(): void {
        this.pool.length = 0;
    }
}

// =============================================================================
// Zephyr Compiler Instance
// =============================================================================

export class Zephyr {
    private config: Required<ZephyrConfig>;
    private registry = new Map<string, Component>();
    private loadingPromises = new Map<string, Promise<Component>>();
    private loadingStack = new Set<string>();
    private collectedStyles = new Set<string>(); // Using Set for O(1) dedup
    private loopPool: LoopContextPool;
    private resolvedPathCache = new Map<string, string>();

    constructor(config: ZephyrConfig = {}) {
        this.config = {
            maxRenderDepth: config.maxRenderDepth ?? 100,
            maxPoolSize: config.maxPoolSize ?? 20,
            verbose: config.verbose ?? false,
            debug: config.debug ?? false,
        };
        this.loopPool = new LoopContextPool(this.config.maxPoolSize);
    }

    // =========================================================================
    // Public API
    // =========================================================================

    async render(entryPath: string): Promise<RenderResult> {
        this.collectedStyles.clear();

        await this.loadComponent(entryPath);
        const html = this.renderComponent(entryPath, {});
        const css = Array.from(this.collectedStyles).join("\n");

        return { html, css };
    }

    clearCache(): void {
        this.registry.clear();
        this.loadingPromises.clear();
        this.loadingStack.clear();
        this.collectedStyles.clear();
        this.loopPool.clear();
        this.resolvedPathCache.clear();
        clearCompilerCaches();
    }

    // =========================================================================
    // Component Loading
    // =========================================================================

    private async loadComponent(filePath: string): Promise<Component> {
        return this.loadWithChain(filePath, []);
    }

    private async loadWithChain(filePath: string, chain: string[]): Promise<Component> {
        const absPath = this.resolvePath(filePath);

        const cached = this.registry.get(absPath);
        if (cached) return cached;

        const existing = this.loadingPromises.get(absPath);
        if (existing) return existing;

        const loadPromise = this.loadComponentInternal(absPath, chain);
        this.loadingPromises.set(absPath, loadPromise);

        try {
            return await loadPromise;
        } finally {
            this.loadingPromises.delete(absPath);
        }
    }

    private async loadComponentInternal(absPath: string, chain: string[]): Promise<Component> {
        if (this.loadingStack.has(absPath)) {
            throw new CircularImportError([...chain, absPath]);
        }

        this.loadingStack.add(absPath);

        try {
            this.log(`Loading ${absPath}`);

            const buffer = await Bun.file(absPath).text();
            const tokenizer = new Tokenizer(buffer);
            const tokens = tokenizer.tokenize();
            const ast = parseTokens(tokens);

            const dir = dirname(absPath);
            const resolvedImports = new Map<string, string>();
            const importPaths: string[] = [];

            for (const imp of ast.imports) {
                const resolvedPath = resolve(dir, imp.path);
                resolvedImports.set(imp.name, resolvedPath);
                importPaths.push(resolvedPath);
            }

            const comp: Component = {
                ...ast,
                resolvedImports,
                filePath: absPath,
            };

            this.registry.set(absPath, comp);

            if (importPaths.length > 0) {
                const newChain = [...chain, absPath];
                await Promise.all(importPaths.map(p => this.loadWithChain(p, newChain)));
            }

            return comp;
        } finally {
            this.loadingStack.delete(absPath);
        }
    }

    // =========================================================================
    // Rendering
    // =========================================================================

    private renderComponent(filePath: string, parentContext: RenderContext): string {
        const absPath = this.resolvePath(filePath);
        return this.renderComponentInternal(absPath, parentContext, 0);
    }

    private renderComponentInternal(
        absPath: string,
        parentContext: RenderContext,
        depth: number
    ): string {
        if (depth > this.config.maxRenderDepth) {
            throw new MaxDepthError(this.config.maxRenderDepth, absPath);
        }

        const comp = this.registry.get(absPath);
        if (!comp) {
            throw new ImportError(`Component not loaded: ${absPath}`, absPath);
        }

        // Collect styles
        if (comp.style) {
            this.collectedStyles.add(comp.style.css);
        }

        const slotContent = parentContext[SLOT_CONTENT];

        let context: RenderContext;
        if (comp.script) {
            context = runScript(comp.script.code, Object.create(parentContext)) as RenderContext;
        } else {
            context = Object.create(parentContext);
        }

        if (slotContent !== undefined) {
            context[SLOT_CONTENT] = slotContent;
        }

        return this.renderChildren(comp.template, context, comp, depth);
    }

    private renderChildren(
        children: TemplateChild[],
        context: RenderContext,
        comp: Component,
        depth: number
    ): string {
        if (children.length === 0) return "";
        if (children.length === 1) {
            return this.renderNode(children[0], context, comp, depth);
        }

        const parts: string[] = [];
        let lastConditionMatched = false;

        for (const child of children) {
            if (child.type === "element" && child.conditional) {
                const cond = child.conditional;

                if (cond.type === "if") {
                    const result = !!evaluateValue(cond.expression!, context);
                    lastConditionMatched = result;
                    if (result) {
                        parts.push(this.renderElement(child, context, comp, depth));
                    }
                } else if (cond.type === "else-if") {
                    if (!lastConditionMatched) {
                        const result = !!evaluateValue(cond.expression!, context);
                        lastConditionMatched = result;
                        if (result) {
                            parts.push(this.renderElement(child, context, comp, depth));
                        }
                    }
                } else if (cond.type === "else") {
                    if (!lastConditionMatched) {
                        parts.push(this.renderElement(child, context, comp, depth));
                    }
                    lastConditionMatched = false;
                }
            } else {
                if (child.type !== "text" || child.value.trim()) {
                    lastConditionMatched = false;
                }
                parts.push(this.renderNode(child, context, comp, depth));
            }
        }

        return parts.join("");
    }

    private renderNode(
        node: TemplateChild,
        context: RenderContext,
        comp: Component,
        depth: number
    ): string {
        switch (node.type) {
            case "text":
                return node.value;
            case "interpolation":
                return compileExpression(node.expression, context, node.raw);
            case "element":
                return this.renderElement(node, context, comp, depth);
        }
    }

    private renderElement(
        node: ElementNode,
        context: RenderContext,
        comp: Component,
        depth: number
    ): string {
        // Handle loops
        if (node.loop) {
            const array = context[node.loop.array];
            if (!Array.isArray(array)) {
                return `<!-- ${node.loop.array} is not an array -->`;
            }

            if (array.length === 0) return "";

            const loopCtx = this.loopPool.acquire();
            loopCtx.setup(context, node.loop.item, node.loop.index);

            const parts: string[] = [];
            for (let i = 0; i < array.length; i++) {
                loopCtx.update(array[i], i);
                parts.push(this.renderElementOnce(node, loopCtx.getContext(), comp, depth));
            }

            this.loopPool.release(loopCtx);
            return parts.join("");
        }

        return this.renderElementOnce(node, context, comp, depth);
    }

    private renderElementOnce(
        node: ElementNode,
        context: RenderContext,
        comp: Component,
        depth: number
    ): string {
        // Handle <slot />
        if (node.tag === "slot") {
            const slotContent = context[SLOT_CONTENT];
            if (slotContent) {
                return slotContent;
            }
            if (node.children.length > 0) {
                return this.renderChildren(node.children, context, comp, depth);
            }
            return "";
        }

        // Handle imported components
        if (comp.resolvedImports.has(node.tag)) {
            const importPath = comp.resolvedImports.get(node.tag)!;
            const propsContext = this.evaluateProps(node.props, context);

            const renderedChildren = node.children.length > 0
                ? this.renderChildren(node.children, context, comp, depth)
                : "";

            const childContext: RenderContext = propsContext
                ? Object.assign(Object.create(context), propsContext)
                : Object.create(context);
            childContext[SLOT_CONTENT] = renderedChildren;

            return this.renderComponentInternal(importPath, childContext, depth + 1);
        }

        // Regular HTML element
        const attrs = this.renderAttributes(node.attributes, node.props, context);

        if (node.selfClosing) {
            return `<${node.tag}${attrs} />`;
        }

        const children = this.renderChildren(node.children, context, comp, depth);
        return `<${node.tag}${attrs}>${children}</${node.tag}>`;
    }

    private evaluateProps(
        props: Map<string, string>,
        context: RenderContext
    ): Record<string, any> | null {
        if (props.size === 0) return null;

        const evaluated: Record<string, any> = {};
        for (const [name, expression] of props) {
            evaluated[name] = evaluateValue(expression, context);
        }
        return evaluated;
    }

    private renderAttributes(
        attributes: Map<string, AttributeValue>,
        props: Map<string, string>,
        context: RenderContext
    ): string {
        const totalSize = attributes.size + props.size;
        if (totalSize === 0) return "";

        const parts: string[] = [];

        // Static attributes
        for (const [name, attr] of attributes) {
            if (attr.value) {
                if (attr.value.includes("{{")) {
                    let renderedValue = attr.value;

                    if (attr.hasRawInterpolation) {
                        renderedValue = renderedValue.replace(
                            /\{\{\{(.+?)\}\}\}/g,
                            (_, expr) => compileExpression(expr.trim(), context, true)
                        );
                    }

                    renderedValue = renderedValue.replace(
                        /\{\{(.+?)\}\}/g,
                        (_, expr) => compileExpression(expr.trim(), context, false)
                    );

                    parts.push(`${name}="${renderedValue}"`);
                } else {
                    parts.push(`${name}="${attr.value}"`);
                }
            } else {
                parts.push(name);
            }
        }

        // Bound props
        for (const [name, expression] of props) {
            const value = compileExpression(expression, context, false);
            parts.push(`${name}="${value}"`);
        }

        return " " + parts.join(" ");
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private resolvePath(filePath: string): string {
        let resolved = this.resolvedPathCache.get(filePath);
        if (!resolved) {
            resolved = resolve(filePath);
            this.resolvedPathCache.set(filePath, resolved);
        }
        return resolved;
    }

    private log(message: string): void {
        if (this.config.verbose || this.config.debug) {
            console.log(`[Zephyr] ${message}`);
        }
    }
}

// =============================================================================
// Default Instance (for backwards compatibility)
// =============================================================================

let defaultInstance: Zephyr | null = null;

export function getDefaultInstance(): Zephyr {
    if (!defaultInstance) {
        defaultInstance = new Zephyr();
    }
    return defaultInstance;
}

export function resetDefaultInstance(): void {
    if (defaultInstance) {
        defaultInstance.clearCache();
    }
    defaultInstance = null;
}
