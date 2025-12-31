/**
 * Tool Registry - Centralized tool registration
 * Import this file to ensure all tools are registered
 */

export * from './ToolRegistry';
export * from './dbToolsRegistry';
export * from './webSearchToolRegistry';
export * from './unsplashToolRegistry';
export * from './connectorToolsRegistry';

import { registerDbTools } from './dbToolsRegistry';
import { registerWebSearchTool } from './webSearchToolRegistry';
import { registerUnsplashSearchTool } from './unsplashToolRegistry';
import { globalToolRegistry } from './ToolRegistry';

// Auto-register all tools when this module is imported
let initialized = false;

export function initializeToolRegistry() {
  if (initialized) {
    return;
  }

  console.log('[ToolRegistry] Initializing tool registry...');

  registerDbTools();
  registerWebSearchTool();
  registerUnsplashSearchTool();

  initialized = true;
  console.log(
    `[ToolRegistry] Initialized with ${globalToolRegistry.count()} tools`
  );
}

// Auto-initialize on import
//initializeToolRegistry();
