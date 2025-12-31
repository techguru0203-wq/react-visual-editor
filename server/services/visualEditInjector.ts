/**
 * Visual Edit Injector Service
 * Injects visual edit support files into project files before deployment
 * This enables click-to-select functionality in the deployed preview
 */

import { ProjectFile } from '../../shared/types/supabaseTypes';

/**
 * Get the inspector script that handles click events in the iframe
 * This script runs inside the deployed app and communicates with parent via postMessage
 */
function getVisualEditInspectorScript(): string {
  return `/**
 * Visual Edit Inspector - Handles element selection in deployed preview
 * Communicates with parent window via postMessage
 */
(function() {
  'use strict';
  
  let isEnabled = false;
  let highlightOverlay = null;
  let selectedOverlay = null;
  let currentTarget = null;
  let editingElement = null;
  let originalText = null;
  
  function createOverlay(type) {
    const overlay = document.createElement('div');
    overlay.className = 'visual-edit-overlay-' + type;
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;transition:all 0.15s ease;display:none;';
    overlay.style.border = type === 'highlight' ? '2px solid #1890ff' : '3px solid #52c41a';
    overlay.style.backgroundColor = type === 'highlight' ? 'rgba(24,144,255,0.1)' : 'rgba(82,196,26,0.15)';
    overlay.style.borderRadius = '4px';
    document.body.appendChild(overlay);
    return overlay;
  }
  
  function updateOverlay(overlay, el) {
    if (!overlay || !el) return;
    const rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';
  }
  
  function hideOverlay(overlay) {
    if (overlay) overlay.style.display = 'none';
  }
  
  function findSourceElement(el) {
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.dataset && current.dataset.sourceFile) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  
  function getElementInfo(el) {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      filePath: el.dataset.sourceFile || '',
      lineNumber: parseInt(el.dataset.sourceLine || '0', 10),
      columnNumber: parseInt(el.dataset.sourceCol || '0', 10),
      elementName: el.dataset.sourceElement || el.tagName.toLowerCase(),
      tagName: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className : '',
      id: el.id || '',
      textContent: (el.textContent || '').trim().substring(0, 100),
      inlineStyle: el.getAttribute('style') || '',
      computedStyles: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        marginTop: style.marginTop,
        marginRight: style.marginRight,
        marginBottom: style.marginBottom,
        marginLeft: style.marginLeft,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        textAlign: style.textAlign,
        lineHeight: style.lineHeight,
      },
    };
  }
  
  function handleMouseMove(e) {
    if (!isEnabled) return;
    const sourceEl = findSourceElement(e.target);
    if (sourceEl && sourceEl !== currentTarget) {
      currentTarget = sourceEl;
      if (!highlightOverlay) highlightOverlay = createOverlay('highlight');
      updateOverlay(highlightOverlay, sourceEl);
    } else if (!sourceEl) {
      currentTarget = null;
      hideOverlay(highlightOverlay);
    }
  }
  
  function findLinkOrButton(el) {
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      const tagName = current.tagName ? current.tagName.toLowerCase() : '';
      if (tagName === 'a' || tagName === 'button') {
        return current;
      }
      if (current.getAttribute && (current.getAttribute('role') === 'button' || current.onclick)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  
  function findTextNodeParent(el) {
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      // Check if element has text content (not just whitespace)
      const textContent = (current.textContent || '').trim();
      if (textContent && textContent.length > 0) {
        // Skip if it's a form element, button, link, or already editable
        const tagName = current.tagName ? current.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'button' || 
            tagName === 'a' || current.contentEditable === 'true') {
          return null;
        }
        // Check if element has source file data (is editable)
        if (current.dataset && current.dataset.sourceFile) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  function startInlineEditing(el) {
    if (!el || editingElement === el) return;
    
    // Stop any existing editing
    if (editingElement) {
      stopInlineEditing(editingElement);
    }
    
    editingElement = el;
    originalText = (el.textContent || '').trim();
    
    // Make element editable
    el.contentEditable = 'true';
    el.style.outline = '2px solid #1890ff';
    el.style.outlineOffset = '2px';
    el.style.cursor = 'text';
    
    // Focus and select text
    el.focus();
    
    // Select all text if it's a single text node
    if (window.getSelection && document.createRange) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    
    console.log('[VisualEdit] Started inline editing:', originalText);
  }

  function stopInlineEditing(el) {
    if (!el || editingElement !== el) return;
    
    const newText = (el.textContent || '').trim();
    el.contentEditable = 'false';
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.cursor = '';
    
    // Only send update if text actually changed
    if (newText !== originalText) {
      const sourceEl = findSourceElement(el);
      if (sourceEl) {
        const info = getElementInfo(sourceEl);
        // Update textContent in info
        info.textContent = newText;
        info.originalText = originalText;
        window.parent.postMessage({ 
          type: 'VISUAL_EDIT_TEXT_UPDATE', 
          payload: info 
        }, '*');
        console.log('[VisualEdit] Text updated:', originalText, '->', newText);
      }
    }
    
    editingElement = null;
    originalText = null;
  }

  function handleClick(e) {
    if (!isEnabled) return;
    
    const isControlClick = e.ctrlKey || e.metaKey;
    const isDoubleClick = e.detail === 2;
    
    // Stop editing if clicking outside
    if (editingElement && !editingElement.contains(e.target)) {
      stopInlineEditing(editingElement);
    }
    
    if (isControlClick) {
      const linkOrButton = findLinkOrButton(e.target);
      if (linkOrButton) {
        if (linkOrButton.tagName && linkOrButton.tagName.toLowerCase() === 'a') {
          const href = linkOrButton.getAttribute('href');
          if (href) {
            console.log('[VisualEdit] Control+Click on link, navigating to:', href);
            return;
          }
        } else {
          console.log('[VisualEdit] Control+Click on button, allowing default action');
          return;
        }
      }
    }
    
    // Check if clicking on text - enable inline editing
    const textParent = findTextNodeParent(e.target);
    if (textParent && !isControlClick) {
      e.preventDefault();
      e.stopPropagation();
      
      // Start inline editing
      startInlineEditing(textParent);
      
      // Also show selected overlay
      if (!selectedOverlay) selectedOverlay = createOverlay('selected');
      updateOverlay(selectedOverlay, textParent);
      
      // Send selection info for panel (optional - user can still open panel with double-click)
      if (isDoubleClick) {
        const info = getElementInfo(textParent);
        window.parent.postMessage({ type: 'VISUAL_EDIT_SELECT', payload: info }, '*');
        console.log('[VisualEdit] Selected (double-click):', info);
      }
      return;
    }
    
    // Normal visual edit selection behavior (for non-text elements or when control is held)
    const sourceEl = findSourceElement(e.target);
    if (sourceEl) {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedOverlay) selectedOverlay = createOverlay('selected');
      updateOverlay(selectedOverlay, sourceEl);
      const info = getElementInfo(sourceEl);
      window.parent.postMessage({ type: 'VISUAL_EDIT_SELECT', payload: info }, '*');
      console.log('[VisualEdit] Selected:', info);
    }
  }
  
  function handleMessage(e) {
    const { type } = e.data || {};
    if (type === 'VISUAL_EDIT_ENABLE') {
      isEnabled = true;
      try {
        if (document.body && document.body.style) {
          document.body.style.cursor = 'crosshair';
        }
      } catch (err) {
        console.warn('[VisualEdit] Error setting cursor:', err);
      }
      console.log('[VisualEdit] Enabled');
    } else if (type === 'VISUAL_EDIT_DISABLE') {
      isEnabled = false;
      try {
        if (document.body && document.body.style) {
          document.body.style.cursor = '';
        }
      } catch (err) {
        console.warn('[VisualEdit] Error resetting cursor:', err);
      }
      hideOverlay(highlightOverlay);
      hideOverlay(selectedOverlay);
      currentTarget = null;
      // Stop any active editing
      if (editingElement) {
        stopInlineEditing(editingElement);
      }
      console.log('[VisualEdit] Disabled');
    }
  }
  
  // Handle blur event to stop editing when element loses focus
  function handleBlur(e) {
    if (editingElement && editingElement === e.target) {
      stopInlineEditing(editingElement);
    }
  }

  // Handle Enter key to stop editing
  function handleKeyDown(e) {
    if (editingElement && (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      stopInlineEditing(editingElement);
    } else if (editingElement && e.key === 'Escape') {
      // Cancel editing on Escape
      if (editingElement) {
        editingElement.textContent = originalText;
        stopInlineEditing(editingElement);
      }
    }
  }

  document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('blur', handleBlur, true);
  document.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('message', handleMessage);
  
  // Notify parent that inspector is ready
  window.parent.postMessage({ type: 'VISUAL_EDIT_READY', payload: { url: location.href } }, '*');
  console.log('[VisualEdit] Inspector loaded and ready');
})();
`;
}

/**
 * Get the hot reload client script that handles code updates in real-time
 * This script runs inside the deployed app and receives code updates via postMessage
 * @param devServerHostPrefix - The host prefix for dev server URLs (e.g., 'http://localhost' or 'https://example.com')
 */
function getHotReloadClientScript(devServerHostPrefix: string = 'http://localhost'): string {
  // Extract hostname without protocol for regex matching
  const hostWithoutProtocol = devServerHostPrefix.replace(/^https?:\/\//, '');
  // Escape special regex characters in hostname
  const escapedHostForRegex = hostWithoutProtocol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use JSON.stringify to safely embed the escaped host in the template literal
  const escapedHostJson = JSON.stringify(escapedHostForRegex);
  
  return `/**
 * Hot Reload Client - Handles real-time code updates in deployed preview
 * Communicates with parent window via postMessage
 */
(function() {
  'use strict';
  
  let isReady = false;
  let codeCache = new Map();
  let updateTimeout = null;
  
  function notifyReady() {
    if (!isReady) {
      isReady = true;
      window.parent.postMessage({ type: 'HOT_RELOAD_READY' }, '*');
      console.log('[HotReload] Client loaded and ready');
    }
  }
  
  function handleCodeUpdate(filePath, content) {
    if (!filePath || !content) return;
    
    // Check if content actually changed
    const cachedContent = codeCache.get(filePath);
    if (cachedContent === content) {
      console.log('[HotReload] Content unchanged for:', filePath);
      return; // No change, skip reload
    }
    
    // Clear previous timeout
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    // Debounce updates
    updateTimeout = setTimeout(() => {
      codeCache.set(filePath, content);
      
      // Check if we're in a dev server (matches host prefix with port 5173-6000)
      // In dev server mode, Vite HMR handles updates automatically - NEVER reload
      const currentUrl = window.location.href;
      
      // More robust dev server detection:
      // 1. Check if URL matches the dev server host prefix with a port (5173-6000)
      // 2. Also check for localhost/127.0.0.1 with common dev ports
      // 3. Account for query parameters in URL
      const escapedHost = ${escapedHostJson};
      const devServerPattern1 = new RegExp('^https?:\\\\/\\\\/' + escapedHost + ':\\\\d{4,5}');
      const devServerPattern2 = /^https?:\\/\\/(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(517[3-9]|51[89]\\d|5[2-9]\\d{2}|[6-9]\\d{3})/;
      const isDevServer = devServerPattern1.test(currentUrl) || devServerPattern2.test(currentUrl);
      
      // In dev server mode, Vite HMR handles everything - exit early, do nothing
      if (isDevServer) {
        console.log('[HotReload] Dev server mode detected (' + currentUrl + ') - Vite HMR will handle updates automatically');
        return; // Exit early - don't reload, don't check HMR
      }
      
      console.log('[HotReload] Not in dev server mode (' + currentUrl + '), checking for HMR...');
      
      // Only for deployed previews (not dev server), try to detect HMR
      try {
        let hasHMR = false;
        
        // For React apps, try to trigger HMR if available
        if (typeof window !== 'undefined' && window.__REACT_HOT_LOADER__) {
          console.log('[HotReload] React HMR detected, skipping manual reload');
          hasHMR = true;
        }
        
        // For Vite apps, check for HMR via window globals (since import.meta only works in modules)
        if (typeof window !== 'undefined') {
          // Check for Vite HMR in a safe way
          var viteHmr = window.__VITE_HMR__ || (window.__VITE__ && window.__VITE__.hmr);
          if (viteHmr) {
            console.log('[HotReload] Vite HMR detected, skipping manual reload');
            hasHMR = true;
          }
        }
        
        // For Next.js apps, try to trigger HMR
        if (typeof window !== 'undefined' && window.__NEXT_DATA__) {
          console.log('[HotReload] Next.js HMR detected, skipping manual reload');
          hasHMR = true;
        }
        
        // Only reload if HMR is not available (we already checked isDevServer above)
        if (!hasHMR) {
          console.log('[HotReload] No HMR detected, reloading page...');
          window.location.reload();
        }
      } catch (error) {
        console.error('[HotReload] Error updating code:', error);
        // Reload as last resort (we already checked isDevServer above)
        window.location.reload();
      }
    }, 500);
  }
  
  function handleMessage(event) {
    const { type, filePath, content } = event.data || {};
    
    if (type === 'CODE_UPDATE') {
      handleCodeUpdate(filePath, content);
    }
  }
  
  // Listen for messages from parent window
  window.addEventListener('message', handleMessage);
  
  // Notify parent when ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    notifyReady();
  } else {
    window.addEventListener('load', notifyReady);
  }
  
  // Also notify immediately (in case load already fired)
  setTimeout(notifyReady, 100);
})();
`;
}

/**
 * Get the Babel plugin that injects data-source-* attributes into JSX elements
 */
function getVisualEditBabelPlugin(): string {
  return `/**
 * Babel plugin that injects source location attributes into JSX elements
 * This enables mapping DOM elements back to source code
 */
module.exports = function({ types: t }) {
  return {
    name: 'visual-edit-source-mapper',
    visitor: {
      JSXOpeningElement(path, state) {
        const { node } = path;
        if (!node.loc) return;
        
        const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '';
        const filename = (state.filename || '').replace(cwd, '').replace(/\\\\/g, '/').replace(/^\\/+/, '');
        
        // Skip if already has source attributes
        if (node.attributes.some(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'data-source-file' }))) return;
        
        // Skip fragments and member expressions
        if (t.isJSXFragment(path.parent) || t.isJSXMemberExpression(node.name)) return;
        
        // Fix string style props - convert to object expression
        // This prevents React errors when style is passed as a string instead of an object
        node.attributes = node.attributes.map(attr => {
          if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'style' })) {
            // Check if style is a string literal (wrong format: style="color: red")
            if (t.isStringLiteral(attr.value)) {
              try {
                // Convert string style to object expression
                // Parse CSS string like "color: red; margin: 10px" into object
                const styleString = attr.value.value;
                const styleObj = {};
                
                // Simple CSS parser - split by semicolon and parse key-value pairs
                styleString.split(';').forEach(rule => {
                  const trimmed = rule.trim();
                  if (trimmed) {
                    const colonIndex = trimmed.indexOf(':');
                    if (colonIndex > 0) {
                      const key = trimmed.substring(0, colonIndex).trim();
                      const value = trimmed.substring(colonIndex + 1).trim();
                      // Convert CSS property name to camelCase (e.g., margin-top -> marginTop)
                      const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                      styleObj[camelKey] = value;
                    }
                  }
                });
                
                // Only convert if we found valid style properties
                if (Object.keys(styleObj).length > 0) {
                  // Create object expression from parsed styles
                  const properties = Object.keys(styleObj).map(key => {
                    return t.objectProperty(
                      t.identifier(key),
                      t.stringLiteral(styleObj[key])
                    );
                  });
                  
                  // Replace string literal with object expression
                  attr.value = t.jsxExpressionContainer(t.objectExpression(properties));
                }
              } catch (err) {
                // If parsing fails, leave it as is (will still error but won't break build)
                console.warn('[VisualEdit] Failed to parse style string:', err);
              }
            }
            // Also check for JSXExpressionContainer with string (style={"color: red"})
            else if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
              try {
                const styleString = attr.value.expression.value;
                const styleObj = {};
                
                styleString.split(';').forEach(rule => {
                  const trimmed = rule.trim();
                  if (trimmed) {
                    const colonIndex = trimmed.indexOf(':');
                    if (colonIndex > 0) {
                      const key = trimmed.substring(0, colonIndex).trim();
                      const value = trimmed.substring(colonIndex + 1).trim();
                      const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                      styleObj[camelKey] = value;
                    }
                  }
                });
                
                if (Object.keys(styleObj).length > 0) {
                  const properties = Object.keys(styleObj).map(key => {
                    return t.objectProperty(
                      t.identifier(key),
                      t.stringLiteral(styleObj[key])
                    );
                  });
                  
                  attr.value.expression = t.objectExpression(properties);
                }
              } catch (err) {
                console.warn('[VisualEdit] Failed to parse style expression:', err);
              }
            }
          }
          return attr;
        });
        
        const elementName = t.isJSXIdentifier(node.name) ? node.name.name : 'unknown';
        
        node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-source-file'), t.stringLiteral(filename)),
          t.jsxAttribute(t.jsxIdentifier('data-source-line'), t.stringLiteral(String(node.loc.start.line))),
          t.jsxAttribute(t.jsxIdentifier('data-source-col'), t.stringLiteral(String(node.loc.start.column))),
          t.jsxAttribute(t.jsxIdentifier('data-source-element'), t.stringLiteral(elementName))
        );
      },
    },
  };
};
`;
}

/**
 * Get modified vite.config.ts that uses Babel plugin for source mapping
 * @param devServerHostPrefix - Dev server host prefix URL (e.g., 'http://localhost' or 'https://example.com')
 * @param devServerPort - Dev server port number
 */
function getViteConfigWithVisualEdit(devServerHostPrefix: string = 'http://localhost', devServerPort: number): string {
  // Extract hostname from prefix for HMR (remove protocol and port if present)
  const backendHost = devServerHostPrefix.replace(/^https?:\/\//, '').split(':')[0] || 'localhost';
  
  // When server.host is '0.0.0.0', we MUST explicitly set hmr.host to tell the browser
  // which hostname to use for WebSocket connections. Without this, Vite tries to auto-detect
  // but often fails, causing WebSocket connection failures and polling fallbacks.
  // Use 'localhost' for local development, or the actual hostname for remote servers
  const hmrHost = backendHost === '0.0.0.0' ? 'localhost' : backendHost;
  
  return `import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const visualEditPlugin = require('./visualEditBabelPlugin.cjs');

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [visualEditPlugin],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: ${devServerPort},
    allowedHosts: ['visualapp.omniflowai.com'],
    hmr: {
      host: '${hmrHost}',
      // Don't set 'port' or 'clientPort' - Vite automatically uses the same port as the HTTP server
      // Explicitly setting host is required when server.host is '0.0.0.0' to prevent WebSocket failures
      protocol: 'ws', // Use ws:// for localhost, wss:// for HTTPS
    },
    // Prevent Vite from falling back to polling when HMR WebSocket fails
    watch: {
      usePolling: false,
    },
  },
});
`;
}

/**
 * Check if project is eligible for visual edit injection
 */
function shouldInjectVisualEdit(files: ProjectFile[]): boolean {
  const hasViteConfig = files.some(f => 
    f.path === 'vite.config.ts' || f.path === 'vite.config.js'
  );
  const hasReact = files.some(f => {
    if (f.path !== 'package.json') return false;
    try {
      const pkg = JSON.parse(f.content);
      return pkg.dependencies?.react || pkg.devDependencies?.react;
    } catch { return false; }
  });
  return hasViteConfig && hasReact;
}

/**
 * Inject visual edit support into project files before deployment
 * @param files - Project files to inject support into
 * @param devServerHostPrefix - Dev server host prefix URL (e.g., 'http://localhost' or 'https://example.com')
 * @param devServerPort - Dev server port number (optional, only needed for dev server mode)
 */
export function injectVisualEditSupport(
  files: ProjectFile[],
  devServerHostPrefix: string = 'http://localhost',
  devServerPort?: number
): ProjectFile[] {
  if (!shouldInjectVisualEdit(files)) {
    console.log('[VisualEdit] Skipping injection - not a Vite/React project');
    return files;
  }

  console.log('[VisualEdit] Injecting visual edit support...');
  
  const result: ProjectFile[] = [];
  const paths = new Set(files.map(f => f.path));

  for (const file of files) {
    if (file.path === 'vite.config.ts' || file.path === 'vite.config.js') {
      // Replace vite config with visual edit version (uses Babel instead of SWC)
      // Only configure HMR if devServerPort is provided (dev server mode)
      const viteConfig = devServerPort 
        ? getViteConfigWithVisualEdit(devServerHostPrefix, devServerPort)
        : getViteConfigWithVisualEdit(devServerHostPrefix, 5173); // Default port for deployment
      result.push({
        ...file,
        path: 'vite.config.ts',
        content: viteConfig,
      });
    } else if (file.path === 'index.html') {
      // Add inspector script and hot reload client to HTML
      let content = file.content;
      if (!content.includes('visualEditInspector.js')) {
        content = content.replace('</head>', '  <script src="/visualEditInspector.js"></script>\n</head>');
      }
      if (!content.includes('hotReloadClient.js')) {
        content = content.replace('</head>', '  <script src="/hotReloadClient.js"></script>\n</head>');
      }
      result.push({ ...file, content });
    } else if (file.path === 'package.json') {
      // Add @vitejs/plugin-react dependency (Babel-based, not SWC)
      try {
        const pkg = JSON.parse(file.content);
        if (pkg.devDependencies) {
          pkg.devDependencies['@vitejs/plugin-react'] = '^4.3.0';
          // Remove SWC version if present
          delete pkg.devDependencies['@vitejs/plugin-react-swc'];
        }
        result.push({ ...file, content: JSON.stringify(pkg, null, 2) });
      } catch {
        result.push(file);
      }
    } else {
      result.push(file);
    }
  }

  // Add visual edit files if not present
  if (!paths.has('visualEditBabelPlugin.cjs')) {
    result.push({
      path: 'visualEditBabelPlugin.cjs',
      content: getVisualEditBabelPlugin(),
      type: 'file',
    });
    console.log('[VisualEdit] Added: visualEditBabelPlugin.cjs');
  }

  if (!paths.has('public/visualEditInspector.js')) {
    result.push({
      path: 'public/visualEditInspector.js',
      content: getVisualEditInspectorScript(),
      type: 'file',
    });
    console.log('[VisualEdit] Added: public/visualEditInspector.js');
  }

  if (!paths.has('public/hotReloadClient.js')) {
    result.push({
      path: 'public/hotReloadClient.js',
      content: getHotReloadClientScript(devServerHostPrefix),
      type: 'file',
    });
    console.log('[HotReload] Added: public/hotReloadClient.js');
  }

  console.log('[VisualEdit] Injection complete!');
  return result;
}

