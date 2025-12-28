/**
 * Zephyr.js Runtime Type Definitions
 * 
 * These types are available globally in .zph files
 */

/**
 * Reactive signal constructor
 * @param initialValue Initial value of the signal
 */
declare function $<T>(initialValue: T): T;

/**
 * Reactive signal constructor (overload for uninitialized)
 */
declare function $<T = any>(): T | undefined;

// We can add more global types here as the framework evolves
