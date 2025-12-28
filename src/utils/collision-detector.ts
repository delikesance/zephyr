/**
 * Scope ID Collision Detection
 * 
 * Detects and warns about scope ID collisions during compilation
 */

export class ScopeIdCollisionDetector {
  private scopeIds: Map<string, string[]> = new Map() // scopeId -> [component names]
  
  /**
   * Register a scope ID for a component
   * Returns true if collision detected
   */
  register(scopeId: string, componentName: string): boolean {
    if (!this.scopeIds.has(scopeId)) {
      this.scopeIds.set(scopeId, [])
    }
    
    const components = this.scopeIds.get(scopeId)!
    components.push(componentName)
    
    // Collision if more than one component has this scope ID
    return components.length > 1
  }
  
  /**
   * Get all collisions
   */
  getCollisions(): Array<{ scopeId: string; components: string[] }> {
    const collisions: Array<{ scopeId: string; components: string[] }> = []
    
    for (const [scopeId, components] of this.scopeIds.entries()) {
      if (components.length > 1) {
        collisions.push({ scopeId, components: [...components] })
      }
    }
    
    return collisions
  }
  
  /**
   * Check if a scope ID has collisions
   */
  hasCollision(scopeId: string): boolean {
    const components = this.scopeIds.get(scopeId)
    return components ? components.length > 1 : false
  }
  
  /**
   * Get components with a specific scope ID
   */
  getComponents(scopeId: string): string[] {
    return [...(this.scopeIds.get(scopeId) || [])]
  }
  
  /**
   * Clear all registered scope IDs
   */
  clear(): void {
    this.scopeIds.clear()
  }
}
