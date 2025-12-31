import React, { useCallback, useEffect, useState } from 'react';
import {
  BoldOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import {
  BubbleMenu,
  EditorContent,
  getHTMLFromFragment,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Button,
  Dropdown,
  Flex,
  message,
  Space,
  Tooltip,
  Typography,
} from 'antd';

import { TemplateDocumentOutput } from '../../containers/documents/types/documentTypes';
import { COLORS } from '../../lib/constants';
import { useLanguageWithFallback } from '../contexts/languageContext';
import { ReactComponent as EmptyIcon } from '../icons/empty-icon.svg';
import { ReactComponent as TemplateButtonIcon } from '../icons/template-button-icon.svg';
import Selection from '../util/editor-extensions/editor-selection';
import { replaceSelection } from '../util/editor-helpers';
import Mermaid from './Mermaid';
import { SelectionMenu } from './SelectionMenu';

import './TiptapEditor.scss';

const SELECTION_OFFSET = 1;

interface TiptapEditorProps {
  value?: string;
  docId?: string;
  onChange?: (value: string) => void;
  onUpdate?: (editor: any, contents: string) => void;
  onClickTemplateIcon?: () => void;
  selectedTemplate?: TemplateDocumentOutput | null;
  showToolbar?: boolean;
  editable?: boolean;
  toolbarHelperText?: string;
  isStreaming?: boolean;
  hasShownSuccessRef?: React.MutableRefObject<boolean>;
}

const Toolbar: React.FC<{
  editor: any;
  toolbarHelperText?: string;
  selectedTemplate?: TemplateDocumentOutput | null;
  onClickTemplateIcon?: () => void;
  isEditable: boolean;
  onSetEditable: (editable: boolean) => void;
}> = ({
  editor,
  toolbarHelperText,
  selectedTemplate,
  onClickTemplateIcon,
  isEditable,
  onSetEditable,
}) => {
  // Use fallback version for public/shared routes that may not have LanguageContext
  const { t } = useLanguageWithFallback();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 899);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  if (!editor) {
    return null;
  }

  const items = [
    {
      key: '0',
      label: (
        <span
          style={{
            fontWeight: !editor.isActive('heading') ? 'bold' : 'normal',
          }}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          {t('common.normalText')}
        </span>
      ),
    },
    {
      key: '1',
      label: (
        <span
          style={{
            fontWeight: editor.isActive('heading', { level: 1 })
              ? 'bold'
              : 'normal',
          }}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          {t('common.heading1')}
        </span>
      ),
    },
    {
      key: '2',
      label: (
        <span
          style={{
            fontWeight: editor.isActive('heading', { level: 2 })
              ? 'bold'
              : 'normal',
          }}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          {t('common.heading2')}
        </span>
      ),
    },
    {
      key: '3',
      label: (
        <span
          style={{
            fontWeight: editor.isActive('heading', { level: 3 })
              ? 'bold'
              : 'normal',
          }}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          {t('common.heading3')}
        </span>
      ),
    },
  ];

  return (
    <Flex className="toolbar" align="center" style={{ width: '100%' }}>
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button>
          {editor.isActive('heading', { level: 1 })
            ? t('common.heading1')
            : editor.isActive('heading', { level: 2 })
              ? t('common.heading2')
              : editor.isActive('heading', { level: 3 })
                ? t('common.heading3')
                : !editor.isActive('heading')
                  ? t('common.normalText')
                  : t('common.heading')}{' '}
          <DownOutlined />
        </Button>
      </Dropdown>
      <Button
        icon={<BoldOutlined />}
        onClick={() => editor.chain().focus().toggleBold().run()}
        type={editor.isActive('bold') ? 'primary' : 'default'}
      />
      <Button
        icon={<ItalicOutlined />}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        type={editor.isActive('italic') ? 'primary' : 'default'}
      />
      <Button
        icon={<UnderlineOutlined />}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        type={editor.isActive('underline') ? 'primary' : 'default'}
      />
      <Button
        icon={<UnorderedListOutlined />}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        type={editor.isActive('bulletList') ? 'primary' : 'default'}
      />
      {!toolbarHelperText && (
        <Button
          style={{
            alignItems: 'center',
            display: 'flex',
          }}
          className="template-btn"
          icon={<TemplateButtonIcon />}
          onClick={() => onClickTemplateIcon && onClickTemplateIcon()}
        >
          {selectedTemplate
            ? t('common.templateInUse').replace('{name}', selectedTemplate.name)
            : t('common.pickTemplate')}
        </Button>
      )}
      {/* <Button
        icon={<CodeOutlined />}
        onClick={(e) => {
          editor.chain().focus().toggleCodeBlock().run();
        }}
        type={editor.isActive('codeBlock') ? 'primary' : 'default'}
      /> */}
      {toolbarHelperText && (
        <Flex>
          {isMobile ? (
            <Tooltip title={toolbarHelperText} placement="top">
              <InfoCircleOutlined
                style={{ fontSize: '24px', margin: '0 5px' }}
              />
            </Tooltip>
          ) : (
            <>
              <InfoCircleOutlined
                style={{ fontSize: '24px', margin: '0 5px' }}
              />
              <Typography.Text
                style={{
                  fontSize: '12px',
                  fontStyle: 'italic',
                  maxWidth: '400px',
                }}
              >
                {toolbarHelperText}
              </Typography.Text>
            </>
          )}
        </Flex>
      )}
      <div style={{ flex: 1 }} />
      <div className="editor-toggle-group">
        <Tooltip title={t('common.edit')}>
          <Button
            type={isEditable ? 'primary' : 'default'}
            icon={<EditOutlined />}
            onClick={() => onSetEditable(true)}
            style={{ marginRight: 4 }}
            aria-label="Edit"
          />
        </Tooltip>
        <Tooltip title={t('common.preview')}>
          <Button
            type={!isEditable ? 'primary' : 'default'}
            icon={<EyeOutlined />}
            onClick={() => onSetEditable(false)}
            aria-label="Preview"
          />
        </Tooltip>
      </div>
    </Flex>
  );
};

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value = '',
  docId,
  onChange,
  onUpdate,
  onClickTemplateIcon,
  isStreaming = false,
  selectedTemplate,
  showToolbar = true,
  editable = true,
  toolbarHelperText = '',
}) => {
  // Use fallback version for public/shared routes that may not have LanguageContext
  const languageContext = useLanguageWithFallback();
  const { t } = languageContext;
  const [editorData, setEditorData] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [isEditable, setIsEditable] = useState(editable);
  const hasShownSuccessRef = React.useRef(false);
  const [hasMermaidDiagrams, setHasMermaidDiagrams] = useState(false);
  const [mermaidZoomLevel, setMermaidZoomLevel] = useState(1);
  const [mermaidToolbarPositions, setMermaidToolbarPositions] = useState<
    Array<{
      element: HTMLElement;
      top: number;
      left: number;
    }>
  >([]);
  const editorWrapperRef = React.useRef<HTMLDivElement>(null);

  const boxStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 6,
    border: '1px solid #40a9ff',
    padding: '5px',
    backgroundColor: '#ffffff',
  };

  const editor = useEditor({
    editable: isEditable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Table.configure({
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }) as any,
      TableRow,
      TableHeader,
      TableCell,
      Mermaid,
      Selection,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      if (!editor.isEditable) return;
      const content = editor.getHTML();
      if (onChange) {
        onChange(content);
      }
      if (onUpdate) {
        onUpdate(editor, content);
      }
    },
    onSelectionUpdate: ({ editor, transaction }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        getSurroundingParagraphs();
        const selectionHtml = getHTMLFromFragment(
          transaction.doc.slice(
            transaction.selection.from - SELECTION_OFFSET,
            transaction.selection.to + SELECTION_OFFSET
          ).content,
          editor.schema
        );
        const cleanedHtml = selectionHtml.replace(
          /<([a-z][a-z0-9]*)\b[^>]*>(\s*|&nbsp;)<\/\1>$/i,
          ''
        );
        setEditorData(cleanedHtml);
      } else {
        setEditorData('');
      }
    },
  });

  const getSurroundingParagraphs = useCallback(() => {
    if (editor == null) {
      return;
    }

    const { from, to } = editor.state.selection;
    const { doc } = editor.state;

    doc.nodesBetween(0, from, (node, pos) => {
      if (node.type.name === 'paragraph' && pos < from) {
        setBefore(node.textContent);
      }
    });

    doc.nodesBetween(to, doc.content.size, (node, pos) => {
      if (node.type.name === 'paragraph' && pos > to) {
        setAfter(node.textContent);
      }
    });
  }, [editor]);

  // Handle content updates and scrolling during streaming
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }

    // Handle scrolling during streaming
    if (isStreaming) {
      const editorElement = document.querySelector('.editor-content');
      const lastChild = editorElement?.lastElementChild;
      if (lastChild) {
        hasShownSuccessRef.current = false; // Reset flag when streaming starts
        lastChild.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest',
        });
      }
    }
  }, [value, editor, isStreaming]);

  // Focus editor and move cursor to start when switching to edit mode
  useEffect(() => {
    if (isEditable && editor) {
      // Move cursor to start and focus
      try {
        if (editor.isEmpty) {
          editor.commands.focus();
        } else if (
          editor.commands &&
          typeof editor.commands.focus === 'function'
        ) {
          editor.commands.focus('start');
        } else {
          editor.commands.setTextSelection(0);
          editor.commands.focus();
        }
      } catch (e) {
        // fallback: just focus
        editor.commands.focus();
      }
    }
  }, [isEditable, editor]);

  // Check for mermaid diagrams and update toolbar positions
  useEffect(() => {
    if (editor && editorWrapperRef.current) {
      const updateToolbarPositions = () => {
        try {
          const proseMirror =
            editorWrapperRef.current?.querySelector('.ProseMirror');
          if (!proseMirror) {
            setHasMermaidDiagrams(false);
            setMermaidToolbarPositions([]);
            return;
          }

          const mermaidDivs = proseMirror.querySelectorAll('div.mermaid');
          const hasMermaid = mermaidDivs.length > 0;
          setHasMermaidDiagrams(hasMermaid);

          if (!hasMermaid) {
            setMermaidZoomLevel(1);
            setMermaidToolbarPositions([]);
            return;
          }

          const wrapperRect = editorWrapperRef.current?.getBoundingClientRect();
          if (!wrapperRect) {
            setMermaidToolbarPositions([]);
            return;
          }

          const positions: Array<{
            element: HTMLElement;
            top: number;
            left: number;
          }> = [];

          mermaidDivs.forEach((mermaidDiv) => {
            const element = mermaidDiv as HTMLElement;

            // Find the "Architecture Diagram" heading (h3) that comes before this mermaid div
            let headingElement: HTMLElement | null = null;

            // Strategy 1: Look backwards through siblings
            let currentElement: Element | null = element.previousElementSibling;
            while (currentElement) {
              if (
                (currentElement.tagName === 'H3' ||
                  currentElement.tagName === 'H2') &&
                currentElement.textContent
                  ?.toLowerCase()
                  .trim()
                  .includes('architecture diagram')
              ) {
                headingElement = currentElement as HTMLElement;
                break;
              }
              currentElement = currentElement.previousElementSibling;
            }

            // Strategy 2: If heading not found in siblings, check parent's previous siblings
            if (!headingElement && element.parentElement) {
              let parentSibling = element.parentElement.previousElementSibling;
              while (parentSibling) {
                const h3 = parentSibling.querySelector('h3, h2');
                if (
                  h3 &&
                  h3.textContent
                    ?.toLowerCase()
                    .trim()
                    .includes('architecture diagram')
                ) {
                  headingElement = h3 as HTMLElement;
                  break;
                }
                parentSibling = parentSibling.previousElementSibling;
              }
            }

            // Strategy 3: Search the entire prose mirror for the heading before this mermaid div
            if (!headingElement && proseMirror) {
              const allElements = Array.from(
                proseMirror.querySelectorAll('h3, h2')
              );

              // Find the last heading before this mermaid div
              for (let i = allElements.length - 1; i >= 0; i--) {
                const heading = allElements[i] as HTMLElement;
                if (
                  heading.textContent
                    ?.toLowerCase()
                    .trim()
                    .includes('architecture diagram')
                ) {
                  // Check if this heading comes before our mermaid div
                  const headingIndex = Array.from(
                    proseMirror.childNodes
                  ).indexOf(heading);
                  const mermaidDivIndex = Array.from(
                    proseMirror.childNodes
                  ).indexOf(element);

                  if (
                    headingIndex < mermaidDivIndex ||
                    heading.compareDocumentPosition(element) &
                      Node.DOCUMENT_POSITION_FOLLOWING
                  ) {
                    headingElement = heading;
                    break;
                  }
                }
              }
            }

            // Use heading position if found, otherwise use mermaid div position
            const targetElement = headingElement || element;
            const rect = targetElement.getBoundingClientRect();

            positions.push({
              element,
              top: rect.top - wrapperRect.top + rect.height + 70, // Position 20px below the heading
              left: rect.left - wrapperRect.left, // Left aligned
            });
          });

          setMermaidToolbarPositions(positions);
        } catch (error) {
          console.error('Error updating toolbar positions:', error);
        }
      };

      // Initial update
      updateToolbarPositions();

      // Update on editor changes
      const updateHandler = () => {
        setTimeout(updateToolbarPositions, 100);
      };

      editor.on('update', updateHandler);

      // Also update on scroll/resize
      const handleScroll = () => {
        updateToolbarPositions();
      };

      const handleResize = () => {
        updateToolbarPositions();
      };

      const wrapper = editorWrapperRef.current;
      if (wrapper) {
        wrapper.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);
      }

      return () => {
        editor.off('update', updateHandler);
        if (wrapper) {
          wrapper.removeEventListener('scroll', handleScroll);
        }
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [editor]);

  // Apply zoom using CSS custom property on the editor wrapper
  useEffect(() => {
    if (editorWrapperRef.current && hasMermaidDiagrams) {
      const proseMirror =
        editorWrapperRef.current.querySelector('.ProseMirror');
      if (proseMirror) {
        (proseMirror as HTMLElement).style.setProperty(
          '--mermaid-zoom',
          String(mermaidZoomLevel)
        );
      }
    }
  }, [mermaidZoomLevel, hasMermaidDiagrams]);

  const handleMermaidZoomIn = useCallback(() => {
    const newZoom = Math.min(mermaidZoomLevel + 0.25, 3);
    setMermaidZoomLevel(newZoom);
  }, [mermaidZoomLevel]);

  const handleMermaidZoomOut = useCallback(() => {
    const newZoom = Math.max(mermaidZoomLevel - 0.25, 0.5);
    setMermaidZoomLevel(newZoom);
  }, [mermaidZoomLevel]);

  // Download functionality temporarily disabled
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMermaidDownload = useCallback(
    async (mermaidElement: HTMLElement) => {
      if (!editor || !editorWrapperRef.current) {
        message.error('Editor not available');
        return;
      }

      try {
        console.log('Download clicked, mermaidElement:', mermaidElement);

        // First, try to find the already rendered SVG in the DOM
        let svgElement: SVGSVGElement | null = null;

        // Check the mermaid element itself for SVG (direct child or descendant)
        svgElement = mermaidElement.querySelector('svg') as SVGSVGElement;
        console.log('SVG found in mermaid element:', !!svgElement);

        // If not found, check if mermaid rendered it as a sibling or in a wrapper
        if (!svgElement) {
          // Check next sibling (mermaid sometimes creates a wrapper)
          let sibling = mermaidElement.nextElementSibling;
          while (sibling && !svgElement) {
            svgElement = sibling.querySelector('svg') as SVGSVGElement;
            if (!svgElement && sibling.tagName === 'svg') {
              svgElement = sibling as SVGSVGElement;
            }
            sibling = sibling.nextElementSibling;
          }
        }

        // If still not found, check parent and its children
        if (!svgElement && mermaidElement.parentElement) {
          const parent = mermaidElement.parentElement;
          svgElement = parent.querySelector('svg') as SVGSVGElement;

          // Also check all siblings of the parent
          if (!svgElement) {
            let parentSibling = parent.nextElementSibling;
            while (parentSibling && !svgElement) {
              svgElement = parentSibling.querySelector('svg') as SVGSVGElement;
              parentSibling = parentSibling.nextElementSibling;
            }
          }
        }

        console.log('Final SVG element found:', !!svgElement);

        // If we found a rendered SVG, use it directly
        if (svgElement) {
          try {
            console.log('Processing SVG element');

            // Get dimensions from the SVG first
            let svgWidth = 1200;
            let svgHeight = 800;

            try {
              // Try getBBox first (most accurate)
              const bbox = svgElement.getBBox();
              if (bbox.width > 0 && bbox.height > 0) {
                svgWidth = bbox.width;
                svgHeight = bbox.height;
                console.log('Using getBBox dimensions:', svgWidth, svgHeight);
              }
            } catch (bboxError) {
              console.log('getBBox failed, trying viewBox/attributes');
              // If getBBox fails, try viewBox or width/height attributes
              const viewBox = svgElement.getAttribute('viewBox');
              if (viewBox) {
                const parts = viewBox.split(/\s+/);
                if (parts.length >= 4) {
                  svgWidth = parseFloat(parts[2]) || 1200;
                  svgHeight = parseFloat(parts[3]) || 800;
                  console.log('Using viewBox dimensions:', svgWidth, svgHeight);
                }
              } else {
                const width = svgElement.getAttribute('width');
                const height = svgElement.getAttribute('height');
                if (width) svgWidth = parseFloat(width) || 1200;
                if (height) svgHeight = parseFloat(height) || 800;
                console.log(
                  'Using width/height attributes:',
                  svgWidth,
                  svgHeight
                );
              }
            }

            // Use computed style dimensions as fallback
            if (svgWidth === 1200 && svgHeight === 800) {
              const computedStyle = window.getComputedStyle(svgElement);
              const width = parseFloat(computedStyle.width);
              const height = parseFloat(computedStyle.height);
              if (width > 0 && height > 0) {
                svgWidth = width;
                svgHeight = height;
                console.log(
                  'Using computed style dimensions:',
                  svgWidth,
                  svgHeight
                );
              }
            }

            // Clone the SVG and ensure it has explicit width/height
            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

            // Ensure the cloned SVG has explicit dimensions
            if (!svgClone.getAttribute('width')) {
              svgClone.setAttribute('width', String(svgWidth));
            }
            if (!svgClone.getAttribute('height')) {
              svgClone.setAttribute('height', String(svgHeight));
            }

            // Ensure viewBox is set if not present
            if (
              !svgClone.getAttribute('viewBox') &&
              svgWidth > 0 &&
              svgHeight > 0
            ) {
              svgClone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
            }

            // Serialize the cloned SVG with explicit dimensions
            const svgData = new XMLSerializer().serializeToString(svgClone);
            if (!svgData || svgData.length === 0) {
              throw new Error('Empty SVG data');
            }

            console.log('SVG data length:', svgData.length);
            console.log('SVG dimensions:', svgWidth, svgHeight);

            // Create canvas directly and draw SVG
            const canvas = document.createElement('canvas');
            canvas.width = svgWidth;
            canvas.height = svgHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              message.error('Failed to create canvas context');
              return;
            }

            // Fill white background first
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Create data URL from SVG
            const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
              svgData
            )}`;

            // Create image from data URL
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
              try {
                console.log(
                  'Image loaded successfully, dimensions:',
                  img.width,
                  img.height,
                  'natural:',
                  img.naturalWidth,
                  img.naturalHeight
                );

                // Use actual image dimensions
                const finalWidth = img.naturalWidth || img.width || svgWidth;
                const finalHeight =
                  img.naturalHeight || img.height || svgHeight;

                console.log(
                  'Drawing image to canvas:',
                  finalWidth,
                  finalHeight
                );

                // Clear and redraw with correct dimensions
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw the SVG image
                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

                // Convert to PNG and download
                canvas.toBlob(
                  (blob) => {
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'architecture-diagram.png';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      message.success('Architecture diagram downloaded');
                      console.log('Download successful, blob size:', blob.size);
                    } else {
                      message.error('Failed to create image blob');
                    }
                  },
                  'image/png',
                  1.0
                );
              } catch (error) {
                console.error('Error converting to PNG:', error);
                message.error(
                  `Failed to convert diagram: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`
                );
              }
            };

            img.onerror = (error) => {
              console.error('Image load error:', error);
              // Fallback: download SVG directly
              const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
              const svgUrl = URL.createObjectURL(svgBlob);
              const a = document.createElement('a');
              a.href = svgUrl;
              a.download = 'architecture-diagram.svg';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(svgUrl);
              message.success('Architecture diagram downloaded as SVG');
            };

            img.src = svgDataUrl;
            return; // Successfully captured from DOM, exit early
          } catch (error) {
            console.error('Error processing rendered SVG:', error);
            message.error(
              `Error processing diagram: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }

        // If no SVG found, show helpful error
        console.error('No SVG element found in mermaid diagram');
        message.warning(
          'Diagram not fully rendered. Please wait a moment and try again.'
        );
      } catch (error) {
        console.error('Error downloading diagram:', error);
        message.error(
          `Failed to download architecture diagram: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },
    [editor]
  );

  return (
    <div className="editor-container">
      {showToolbar && (
        <Toolbar
          selectedTemplate={selectedTemplate}
          onClickTemplateIcon={onClickTemplateIcon}
          editor={editor}
          toolbarHelperText={toolbarHelperText}
          isEditable={isEditable}
          onSetEditable={(val) => {
            setIsEditable(val);
            if (editor) editor.setEditable(val);
          }}
        />
      )}
      {editor && isEditable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{
            placement: 'bottom-start',
            maxWidth: '100%',
            zIndex: 1,
          }}
        >
          {
            <Space>
              <Flex style={boxStyle} gap="small">
                <SelectionMenu
                  key={editor.state.selection.to}
                  onAccept={(generatedText) => {
                    replaceSelection(editor, generatedText, editorData);
                    const { from } = editor.state.selection;
                    editor.commands.setTextSelection(from);
                  }}
                  editorData={{
                    selection: editorData,
                    after,
                    before,
                    docId: docId as string,
                  }}
                />
                <Button
                  icon={<BoldOutlined />}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  type={editor.isActive('bold') ? 'primary' : 'default'}
                />
                <Button
                  icon={<ItalicOutlined />}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  type={editor.isActive('italic') ? 'primary' : 'default'}
                />
                <Button
                  icon={<UnderlineOutlined />}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  type={editor.isActive('underline') ? 'primary' : 'default'}
                />
                <Button
                  icon={<StrikethroughOutlined />}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  type={editor.isActive('strike') ? 'primary' : 'default'}
                />
                <Button
                  icon={<UnorderedListOutlined />}
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  type={editor.isActive('bulletList') ? 'primary' : 'default'}
                />
              </Flex>
            </Space>
          }
        </BubbleMenu>
      )}
      {hasMermaidDiagrams &&
        mermaidToolbarPositions.map((position, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 1000,
              backgroundColor: '#fff',
              padding: '8px',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Button
              icon={<ZoomOutOutlined />}
              onClick={handleMermaidZoomOut}
              disabled={mermaidZoomLevel <= 0.5}
              size="small"
              type="text"
            />
            <span
              style={{
                fontSize: '12px',
                color: '#666',
                minWidth: '40px',
                textAlign: 'center',
              }}
            >
              {Math.round(mermaidZoomLevel * 100)}%
            </span>
            <Button
              icon={<ZoomInOutlined />}
              onClick={handleMermaidZoomIn}
              disabled={mermaidZoomLevel >= 3}
              size="small"
              type="text"
            />
          </div>
        ))}
      {editor && (
        <div
          className="editor-scroll-wrapper"
          ref={editorWrapperRef}
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <div className="editor-content">
            {!isEditable && editor.isEmpty ? (
              <Flex align="center" justify="center">
                <div
                  style={{
                    textAlign: 'center',
                    color: COLORS.GRAY,
                    margin: '50px',
                  }}
                >
                  <EmptyIcon />
                  <div style={{ marginTop: '10px' }}>
                    {t('common.noContentAvailable')}
                  </div>
                </div>
              </Flex>
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TiptapEditor;
