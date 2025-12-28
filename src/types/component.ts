/**
 * Component-related type definitions
 */

/**
 * Represents a parsed Zephyr component
 */
export interface ZephyrComponent {
  /** The name/identifier of the component */
  name: string
  /** JavaScript/TypeScript code for the component */
  script: string
  /** HTML template for the component */
  template: string
  /** Scoped CSS styles for the component */
  style: string
  /** Whether the style section is scoped (true if <style scoped>, false if <style>) */
  styleScoped: boolean
  /** Component imports (e.g., <import Foo from "./foo.zph">) */
  imports: Array<{ name: string; path: string }>
  /** Unique scope identifier for this component instance */
  scopeId: string
  /** Store section content (for store components) */
  store?: string
  /** Whether this is a store component (has <store> instead of <template>) */
  isStore: boolean
}

