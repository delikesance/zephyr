/**
 * Component Props and Slots
 * 
 * Handles props passing and slot content projection
 * Phase 3.2: Component composition
 */

export interface ComponentProps {
  /** Component name */
  componentName: string
  /** Props as key-value pairs */
  props: Map<string, string>
  /** Slot content (if any) */
  slotContent?: string
}

/**
 * Parse props from component tag
 * Example: <Button label="Click me" disabled="false">
 */
export function parseComponentProps(tagHTML: string): ComponentProps | null {
  // Match component tag: <ComponentName prop1="value1" prop2="value2">
  const tagMatch = tagHTML.match(/<(\w+)([^>]*)>/)
  if (!tagMatch) {
    return null
  }
  
  const componentName = tagMatch[1]
  const attributes = tagMatch[2]
  
  // Parse attributes as props
  const props = new Map<string, string>()
  const attrPattern = /(\w+)=["']([^"']+)["']/g
  
  let attrMatch
  while ((attrMatch = attrPattern.exec(attributes)) !== null) {
    const propName = attrMatch[1]
    const propValue = attrMatch[2]
    props.set(propName, propValue)
  }
  
  return {
    componentName,
    props,
  }
}

/**
 * Extract slot content from component tag
 * Example: <Card><h1>Title</h1></Card>
 */
export function extractSlotContent(
  template: string,
  componentStart: number,
  componentName: string
): string | null {
  // Find matching closing tag
  const closingTag = `</${componentName}>`
  const closingPos = template.indexOf(closingTag, componentStart)
  
  if (closingPos === -1) {
    return null // Self-closing tag or no closing tag
  }
  
  // Find content between opening and closing tag
  const tagEnd = template.indexOf('>', componentStart)
  if (tagEnd === -1) {
    return null
  }
  
  const contentStart = tagEnd + 1
  const content = template.slice(contentStart, closingPos).trim()
  
  return content || null
}

/**
 * Replace slot placeholder in component template with actual content
 */
export function replaceSlot(
  componentTemplate: string,
  slotContent: string
): string {
  // Replace <slot></slot> or <slot/> with content
  // If slotContent is empty, remove the slot tag entirely
  if (!slotContent || slotContent.trim() === '') {
    return componentTemplate.replace(/<slot\s*\/?>.*?<\/slot>|<slot\s*\/?>/g, '')
  }
  return componentTemplate.replace(/<slot\s*\/?>.*?<\/slot>|<slot\s*\/?>/g, slotContent)
}

/**
 * Inject props into component script
 * This would be called during component compilation to make props available
 */
export function injectProps(
  componentScript: string,
  props: Map<string, string>
): string {
  if (props.size === 0) {
    return componentScript
  }
  
  // Generate props object
  const propsObject: Record<string, string> = {}
  for (const [key, value] of props) {
    propsObject[key] = value
  }
  
  // Inject at the beginning of script
  const propsCode = `const props = ${JSON.stringify(propsObject)};\n`
  
  return propsCode + componentScript
}
