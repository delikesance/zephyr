/**
 * Zephyr Core
 * 
 * Instance-based architecture for the Zephyr templating engine.
 * All state is contained within instances, making it thread-safe and testable.
 */

import { resolve, dirname } from "path";
import { readFile } from "fs/promises";
import { ComponentAST, TemplateChild, ElementNode, AttributeValue, StyleNode } from "./parser";
import { Tokenizer } from "./tokenizer";
import { parseTokens } from "./parser";
import {
    compileExpression,
    evaluateValue,
    runScript,
    escapeHtml,
    clearCaches as clearCompilerCaches,
    extractVariables,
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
    js: string | null;
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
        const comp = this.registry.get(this.resolvePath(entryPath));
        if (!comp) {
            throw new ImportError(`Component not loaded: ${entryPath}`, entryPath);
        }

        // Generate instance ID (consistent for HTML and JS)
        const instanceId = `zephyr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Get initial context from script
        const initialContext: RenderContext = {};
        if (comp.script) {
            const scriptContext = runScript(comp.script.code, {}) as RenderContext;
            Object.assign(initialContext, scriptContext);
        }

        // Analyze component for reactivity
        const reactiveVars = this.analyzeReactiveVariables(comp, initialContext);
        const eventHandlers = this.analyzeEventHandlers(comp);
        const allInterpolations = this.analyzeInterpolations(comp);
        
        // Filter interpolations to only include those that reference reactive variables
        const reactiveInterpolations = allInterpolations.filter(interp => {
            // Check if ANY dependency is a reactive variable
            return Array.from(interp.dependencies).some(dep => reactiveVars.has(dep));
        });

        // Only set up reactivity if there's actual reactivity to handle
        const hasReactivity = reactiveVars.size > 0 || eventHandlers.length > 0 || reactiveInterpolations.length > 0;
        
        if (hasReactivity) {
            // Store reactivity info for HTML rendering
            // Create a map of (tag, event) -> handler index for quick lookup
            const handlerMap = new Map<string, number>();
            eventHandlers.forEach((handler, idx) => {
                handlerMap.set(`${handler.tag}:${handler.event}`, idx);
            });

            this.currentReactivity = {
                instanceId,
                reactiveVars,
                eventHandlers,
                interpolations: reactiveInterpolations, // Only reactive interpolations
                handlerMap,
            };
        } else {
            this.currentReactivity = null;
        }

        // Render HTML (will use reactivity info)
        const html = this.renderComponent(entryPath, {});
        const css = Array.from(this.collectedStyles).join("\n");

        // Generate reactive JavaScript if needed
        const js = hasReactivity
            ? this.generateReactiveJS(comp, reactiveVars, eventHandlers, reactiveInterpolations, initialContext, instanceId)
            : null;

        // Clear reactivity info
        this.currentReactivity = null;

        return { html, css, js };
    }

    // Store current reactivity info during rendering
    private currentReactivity: {
        instanceId: string;
        reactiveVars: Set<string>;
        eventHandlers: Array<{ event: string; code: string; elementId: string; tag: string }>;
        interpolations: Array<{ expression: string; elementId: string; dependencies: Set<string> }>;
        handlerMap: Map<string, number>;
    } | null = null;

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

            // Cross-platform file reading: use Bun.file if available, otherwise Node.js fs
            let buffer: string;
            if (typeof Bun !== "undefined" && Bun.file) {
                buffer = await Bun.file(absPath).text();
            } else {
                buffer = await readFile(absPath, "utf-8");
            }
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
                // Mark interpolation for reactive JS binding
                const interpId = this.currentReactivity?.interpolations.find(
                    i => i.expression === node.expression
                )?.elementId;
                const value = compileExpression(node.expression, context, node.raw);
                // Wrap in span with data attribute for reactive binding
                return interpId 
                    ? `<span data-interp="${interpId}">${value}</span>`
                    : value;
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
        // Check for event handlers first
        let handlerIdx: number | undefined;
        const filteredAttrs = new Map(node.attributes);
        
        if (this.currentReactivity && node.attributes) {
            for (const [attr, value] of node.attributes) {
                if (attr.startsWith("on") && attr.length > 2) {
                    const event = attr.substring(2).toLowerCase();
                    const handlerKey = `${node.tag}:${event}`;
                    handlerIdx = this.currentReactivity.handlerMap.get(handlerKey);
                    if (handlerIdx !== undefined) {
                        // Remove the onclick attribute (we handle via delegation)
                        filteredAttrs.delete(attr);
                        break;
                    }
                }
            }
        }
        
        let attrs = this.renderAttributes(filteredAttrs, node.props, context);
        
        // Add instance ID to root element (first element in template) only if there's reactivity
        if (depth === 0 && comp.template[0] === node && this.currentReactivity) {
            attrs += ` data-zephyr-instance="${this.currentReactivity.instanceId}"`;
        }
        
        // Add event handler data attribute
        if (handlerIdx !== undefined) {
            attrs += ` data-handler="${handlerIdx}"`;
        }

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
    // Reactive JavaScript Generation
    // =========================================================================

    /**
     * Analyze component for reactive variables (from script block)
     */
    private analyzeReactiveVariables(comp: Component, context: RenderContext): Set<string> {
        const vars = new Set<string>();
        
        if (comp.script) {
            // Extract variable assignments from script: this.var = value
            const assignments = comp.script.code.match(/this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g);
            if (assignments) {
                for (const assignment of assignments) {
                    const match = assignment.match(/this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/);
                    if (match) {
                        vars.add(match[1]);
                    }
                }
            }
        }
        
        return vars;
    }

    /**
     * Analyze component for event handlers (onclick, onchange, etc.)
     */
    private analyzeEventHandlers(comp: Component): Array<{ event: string; code: string; elementId: string; tag: string }> {
        const handlers: Array<{ event: string; code: string; elementId: string; tag: string }> = [];
        let elementIdCounter = 0;

        const traverse = (nodes: TemplateChild[]) => {
            for (const node of nodes) {
                if (node.type === "element") {
                    elementIdCounter++;
                    const elementId = `el-${elementIdCounter}`;
                    
                    // Check all attributes for event handlers
                    for (const [attr, value] of node.attributes) {
                        if (attr.startsWith("on") && attr.length > 2) {
                            const event = attr.substring(2); // Remove "on" prefix
                            handlers.push({
                                event: event.toLowerCase(),
                                code: value.value,
                                elementId: `${node.tag}-${elementIdCounter}`, // Use tag + counter for uniqueness
                                tag: node.tag,
                            });
                        }
                    }
                    
                    // Check children
                    if (node.children.length > 0) {
                        traverse(node.children);
                    }
                }
            }
        };

        traverse(comp.template);
        return handlers;
    }

    /**
     * Analyze component for interpolations ({{variable}})
     */
    private analyzeInterpolations(comp: Component): Array<{ expression: string; elementId: string; dependencies: Set<string> }> {
        const interpolations: Array<{ expression: string; elementId: string; dependencies: Set<string> }> = [];
        let elementIdCounter = 0;

        const traverse = (nodes: TemplateChild[]) => {
            for (const node of nodes) {
                if (node.type === "interpolation") {
                    elementIdCounter++;
                    // Extract dependencies from expression
                    const deps = new Set(extractVariables(node.expression));
                    interpolations.push({
                        expression: node.expression,
                        elementId: `interp-${elementIdCounter}`,
                        dependencies: deps,
                    });
                } else if (node.type === "element" && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };

        traverse(comp.template);
        return interpolations;
    }

    /**
     * Generate reactive JavaScript code
     */
    private generateReactiveJS(
        comp: Component,
        reactiveVars: Set<string>,
        eventHandlers: Array<{ event: string; code: string; elementId: string; tag: string }>,
        interpolations: Array<{ expression: string; elementId: string; dependencies: Set<string> }>,
        initialContext: RenderContext,
        instanceId: string
    ): string {
        const varArray = Array.from(reactiveVars);
        
        // Generate initial values
        const initialValues: Record<string, any> = {};
        for (const varName of varArray) {
            initialValues[varName] = initialContext[varName] ?? null;
        }

        // Generate reactive state object
        const reactiveState = varArray.map(v => {
            const val = initialValues[v];
            const valueStr = typeof val === 'function' 
                ? val.toString() 
                : JSON.stringify(val ?? null);
            return `    ${v}: { 
      value: ${typeof val === 'function' ? val : valueStr}, 
      nodes: []
    }`;
        }).join(',\n');

        // Separate simple variable interpolations from complex expressions
        // Simple: expression IS just the variable name (e.g., "count")
        // Complex: expression contains operators, property access, etc. (e.g., "count + 1")
        const simpleInterpolations = interpolations.filter(interp => {
            const deps = Array.from(interp.dependencies);
            // Simple if: exactly one dependency AND expression matches that variable name exactly
            if (deps.length === 1 && reactiveVars.has(deps[0])) {
                const trimmedExpr = interp.expression.trim();
                return trimmedExpr === deps[0];
            }
            return false;
        });
        
        const complexExpressions = interpolations.filter(interp => {
            const deps = Array.from(interp.dependencies);
            // Complex if: multiple dependencies OR expression is not just the variable name
            if (deps.length === 1 && reactiveVars.has(deps[0])) {
                const trimmedExpr = interp.expression.trim();
                return trimmedExpr !== deps[0];
            }
            return deps.some(d => reactiveVars.has(d));
        });

        // Generate expression bindings for complex expressions
        const expressionBindingsCode = complexExpressions.map(interp => {
            const deps = Array.from(interp.dependencies).filter(d => reactiveVars.has(d));
            if (deps.length === 0) return '';
            
            const depParams = deps.join(', ');
            const depValues = deps.map(d => `reactive.${d}.value`).join(', ');
            const safeId = interp.elementId.replace(/-/g, '_');
            
            return `  {
    id: '${interp.elementId}',
    expr: '${interp.expression.replace(/'/g, "\\'")}',
    dependencies: [${deps.map(d => `'${d}'`).join(', ')}],
    evaluator: function(${depParams}) { return (${interp.expression}); },
    node: null
  }`;
        }).filter(Boolean).join(',\n');

        // Generate update function
        const updateCode = `
  function update(name, value) {
    const state = reactive[name];
    if (!state) return;
    
    state.value = value;
    const str = String(value);
    
    // Update direct variable bindings (simple interpolations)
    for (const node of state.nodes) {
      if (node.nodeType === 3) {
        node.nodeValue = str;
      } else {
        node.textContent = str;
      }
    }
    
    // Update complex expressions that depend on this variable
    ${complexExpressions.length > 0 ? `
    for (const binding of expressionBindings) {
      if (binding.dependencies.includes(name) && binding.node) {
        const deps = binding.dependencies.map(d => reactive[d].value);
        const result = binding.evaluator(...deps);
        const resultStr = String(result);
        if (binding.node.nodeType === 3) {
          binding.node.nodeValue = resultStr;
        } else {
          binding.node.textContent = resultStr;
        }
      }
    }` : ''}
  }`;

        // Group handlers by event type for efficient event delegation
        const handlersByEvent = new Map<string, number[]>();
        eventHandlers.forEach((handler, idx) => {
            if (!handlersByEvent.has(handler.event)) {
                handlersByEvent.set(handler.event, []);
            }
            handlersByEvent.get(handler.event)!.push(idx);
        });

        // Generate event handler setup
        const eventHandlerCode = eventHandlers.length > 0 ? eventHandlers.map((handler, idx) => {
            // Transform handler code to use update() for reactive vars
            let transformedCode = handler.code;
            for (const varName of varArray) {
                // Replace var++ with update('var', var + 1)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*\\+\\+`, 'g'),
                    `update('${varName}', reactive.${varName}.value + 1)`
                );
                // Replace var-- with update('var', var - 1)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*--`, 'g'),
                    `update('${varName}', reactive.${varName}.value - 1)`
                );
                
                // Handle compound assignments (must be BEFORE simple assignment)
                // Replace var += expr with update('var', var + expr)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*\\+=\\s*([^;]+)`, 'g'),
                    (match, expr) => {
                        // Skip if already transformed
                        if (transformedCode.includes(`update('${varName}'`)) return match;
                        return `update('${varName}', reactive.${varName}.value + ${expr.trim()})`;
                    }
                );
                // Replace var -= expr with update('var', var - expr)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*-=\\s*([^;]+)`, 'g'),
                    (match, expr) => {
                        if (transformedCode.includes(`update('${varName}'`)) return match;
                        return `update('${varName}', reactive.${varName}.value - ${expr.trim()})`;
                    }
                );
                // Replace var *= expr with update('var', var * expr)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*\\*=\\s*([^;]+)`, 'g'),
                    (match, expr) => {
                        if (transformedCode.includes(`update('${varName}'`)) return match;
                        return `update('${varName}', reactive.${varName}.value * ${expr.trim()})`;
                    }
                );
                // Replace var /= expr with update('var', var / expr)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*/=\\s*([^;]+)`, 'g'),
                    (match, expr) => {
                        if (transformedCode.includes(`update('${varName}'`)) return match;
                        return `update('${varName}', reactive.${varName}.value / ${expr.trim()})`;
                    }
                );
                
                // Replace var = value with update('var', value)
                transformedCode = transformedCode.replace(
                    new RegExp(`\\b${varName}\\s*=\\s*([^;]+)`, 'g'),
                    (match, value) => {
                        // Check if it's already wrapped in update()
                        if (transformedCode.includes(`update('${varName}'`)) return match;
                        return `update('${varName}', ${value.trim()})`;
                    }
                );
            }
            
            return `  handlers.set('${idx}', function() {
    ${transformedCode};
  });`;
        }).join('\n') : '';

        // Generate initialization code
        const initCode = `
  function init(container) {
    container = container || document;
    
    // Find simple interpolation nodes and bind them to variables
    ${simpleInterpolations.map(interp => {
        const deps = Array.from(interp.dependencies);
        if (deps.length === 1 && reactiveVars.has(deps[0])) {
            const varName = deps[0];
            const safeId = interp.elementId.replace(/-/g, '_');
            return `    const ${safeId} = container.querySelector('[data-interp="${interp.elementId}"]');
    if (${safeId}) {
      const textNode = ${safeId}.firstChild;
      if (textNode && textNode.nodeType === 3) {
        reactive.${varName}.nodes.push(textNode);
      } else {
        reactive.${varName}.nodes.push(${safeId});
      }
    }`;
        }
        return '';
    }).filter(Boolean).join('\n')}
    
    // Find complex expression nodes and bind them
    ${complexExpressions.map(interp => {
        const deps = Array.from(interp.dependencies).filter(d => reactiveVars.has(d));
        if (deps.length === 0) return '';
        
        const safeId = interp.elementId.replace(/-/g, '_');
        const depValues = deps.map(d => `reactive.${d}.value`).join(', ');
        
        return `    const ${safeId} = container.querySelector('[data-interp="${interp.elementId}"]');
    if (${safeId}) {
      const binding = expressionBindings.find(b => b.id === '${interp.elementId}');
      if (binding) {
        const textNode = ${safeId}.firstChild;
        binding.node = (textNode && textNode.nodeType === 3) ? textNode : ${safeId};
        // Evaluate initial value
        const initialValue = binding.evaluator(${depValues});
        binding.node.textContent = String(initialValue);
      }
    }`;
    }).filter(Boolean).join('\n')}
    
    // Set up event delegation for each event type
    ${eventHandlers.length > 0 ? Array.from(handlersByEvent.keys()).map(eventType => `
    container.addEventListener('${eventType}', function(e) {
      const target = e.target.closest('[data-handler]');
      if (target) {
        const handlerId = target.getAttribute('data-handler');
        if (handlerId !== null) {
          const handler = handlers.get(handlerId);
          if (handler) {
            handler();
            e.preventDefault();
          }
        }
      }
    }, true);`).join('\n') : ''}
  }`;

        // Full reactive JS code
        return `(function() {
  'use strict';
  
  const instanceId = '${instanceId}';
  const reactive = {
${reactiveState}
  };
  
${updateCode}
  
${eventHandlers.length > 0 ? `  const handlers = new Map();
${eventHandlerCode}` : ''}
  
${complexExpressions.length > 0 ? `  const expressionBindings = [
${expressionBindingsCode}
  ];` : ''}
  
${initCode}
  
  // Initialize when DOM is ready
  function initialize() {
    const container = document.querySelector('[data-zephyr-instance="' + instanceId + '"]');
    if (container) {
      init(container);
    } else {
      setTimeout(initialize, 10);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();`;
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
