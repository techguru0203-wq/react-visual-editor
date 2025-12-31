import { mergeAttributes, Node } from '@tiptap/core';
import mermaid from 'mermaid';

export default Node.create({
  name: 'mermaid',
  group: 'block',
  content: 'text*',
  code: true,
  defining: true,

  addAttributes() {
    return {
      language: {
        default: 'mermaid',
      },
    };
  },

  parseHTML() {
    // Parse the HTML blocks that are <div class="mermaid">
    return [
      {
        tag: 'div.mermaid',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'mermaid' }), 0];
  },

  // Add the node in the editor with mermaid rendering
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'mermaid';
      dom.innerHTML = node.textContent;

      const renderMermaid = async () => {
        try {
          // Check if already rendered to avoid re-rendering
          if (dom.querySelector('svg')) {
            return;
          }

          // Clear text content but keep the DOM structure intact
          const textContent = dom.textContent || '';
          if (textContent.trim()) {
            // Only initialize once
            mermaid.initialize({ startOnLoad: false });
            await mermaid.run({ nodes: [dom] });
          }
        } catch (error) {
          console.error('Mermaid rendering error', error);
        }
      };

      // Delay rendering to ensure DOM is stable
      setTimeout(() => {
        renderMermaid();
      }, 100);

      return {
        dom,
        update: (updatedNode) => {
          try {
            if (updatedNode.textContent !== node.textContent) {
              // Store the new text content
              const newTextContent = updatedNode.textContent || '';

              // Only update if content actually changed
              if (dom.textContent !== newTextContent) {
                // Use requestAnimationFrame to ensure DOM is stable before manipulation
                requestAnimationFrame(() => {
                  try {
                    // Find and remove only the SVG if it's still a direct child
                    const existingSvg = dom.querySelector('svg');
                    if (existingSvg) {
                      // Double-check parent before removal
                      if (
                        existingSvg.parentNode === dom &&
                        dom.contains(existingSvg)
                      ) {
                        dom.removeChild(existingSvg);
                      }
                    }

                    // Update text content safely
                    // Find text nodes and update them, or create new one
                    let textNodeFound = false;
                    const childNodes = Array.from(dom.childNodes); // Create snapshot to avoid live collection issues
                    for (const child of childNodes) {
                      if (child.nodeType === 3) {
                        // TEXT_NODE = 3
                        if (!textNodeFound) {
                          // Only update if still a child
                          if (child.parentNode === dom) {
                            child.textContent = newTextContent;
                            textNodeFound = true;
                          }
                        } else {
                          // Remove duplicate text nodes
                          if (child.parentNode === dom && dom.contains(child)) {
                            dom.removeChild(child);
                          }
                        }
                      }
                    }

                    // If no text node found, create one
                    if (!textNodeFound) {
                      dom.appendChild(document.createTextNode(newTextContent));
                    }

                    // Re-render mermaid after a delay to ensure DOM is stable
                    setTimeout(() => {
                      renderMermaid();
                    }, 100);
                  } catch (error) {
                    console.error('Error updating mermaid content:', error);
                  }
                });
              }
            }
            return true;
          } catch (error) {
            console.error('Mermaid update error', error);
            return false;
          }
        },
      };
    };
  },
});
