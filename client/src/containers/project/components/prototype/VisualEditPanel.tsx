import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  ColorPicker,
  Flex,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Tag,
  Divider,
  message,
} from 'antd';
import {
  CloseOutlined,
  EditOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface SelectedElement {
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  elementName: string;
  tagName: string;
  textContent: string;
  className?: string;
  id?: string;
  inlineStyle?: string;
  computedStyles?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    marginTop?: string;
    marginRight?: string;
    marginBottom?: string;
    marginLeft?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    textAlign?: string;
    lineHeight?: string;
  };
}

interface ProjectFile {
  path: string;
  content: string;
  type: 'file';
}

interface VisualEditPanelProps {
  selectedElement: SelectedElement | null;
  projectFiles: ProjectFile[];
  onClose: () => void;
  onSave: (updatedFiles: ProjectFile[]) => void;
  onDeploy?: () => void;
}

export function VisualEditPanel({
  selectedElement,
  projectFiles,
  onClose,
  onSave,
  onDeploy,
}: VisualEditPanelProps) {
  const [editedText, setEditedText] = useState('');
  const [editedClassName, setEditedClassName] = useState('');
  
  // State for direct style properties
  const [styles, setStyles] = useState({
    color: '#000000',
    backgroundColor: 'transparent',
    fontSize: 16,
    fontSizeUnit: 'px',
    fontWeight: '400',
    fontFamily: 'inherit',
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginUnit: 'px',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingUnit: 'px',
    textAlign: 'left',
    lineHeight: 24, // in pixels
    lineHeightUnit: 'px',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Helper to convert CSS value to number
  const parseCSSValue = (value: string): { num: number; unit: string } => {
    if (!value || value === 'inherit' || value === 'initial' || value === 'unset') {
      return { num: 0, unit: 'px' };
    }
    const match = value.match(/(\d+(?:\.\d+)?)(px|em|rem|%)?/);
    if (match) {
      return { num: parseFloat(match[1]), unit: match[2] || 'px' };
    }
    return { num: 0, unit: 'px' };
  };

  // Helper to convert hex color from rgb/rgba
  const rgbToHex = (rgb: string): string => {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') {
      return '#000000';
    }
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }
    return '#000000';
  };

  useEffect(() => {
    if (selectedElement) {
      setEditedText(selectedElement.textContent || '');
      setEditedClassName(selectedElement.className || '');
      
      // Extract computed styles
      const computed = selectedElement.computedStyles || {};
      
      setStyles({
        color: rgbToHex(computed.color || '#000000'),
        backgroundColor: computed.backgroundColor === 'rgba(0, 0, 0, 0)' || !computed.backgroundColor 
          ? 'transparent' 
          : rgbToHex(computed.backgroundColor),
        fontSize: parseCSSValue(computed.fontSize || '16px').num,
        fontSizeUnit: parseCSSValue(computed.fontSize || '16px').unit,
        fontWeight: computed.fontWeight || '400',
        fontFamily: computed.fontFamily?.replace(/['"]/g, '').split(',')[0].trim() || 'inherit',
        marginTop: parseCSSValue(computed.marginTop || '0px').num,
        marginRight: parseCSSValue(computed.marginRight || '0px').num,
        marginBottom: parseCSSValue(computed.marginBottom || '0px').num,
        marginLeft: parseCSSValue(computed.marginLeft || '0px').num,
        marginUnit: parseCSSValue(computed.marginTop || '0px').unit,
        paddingTop: parseCSSValue(computed.paddingTop || '0px').num,
        paddingRight: parseCSSValue(computed.paddingRight || '0px').num,
        paddingBottom: parseCSSValue(computed.paddingBottom || '0px').num,
        paddingLeft: parseCSSValue(computed.paddingLeft || '0px').num,
        paddingUnit: parseCSSValue(computed.paddingTop || '0px').unit,
        textAlign: computed.textAlign || 'left',
        // Convert line height to pixels: if it's a number (like 1.5), multiply by font size
        // If it's already in pixels, use that value
        lineHeight: (() => {
          const lineHeightValue = computed.lineHeight || '1.5';
          const fontSizeValue = parseCSSValue(computed.fontSize || '16px').num;
          const lineHeightNum = parseFloat(lineHeightValue);
          
          // If line height is a unitless number (like 1.5), convert to pixels
          if (lineHeightValue && !lineHeightValue.match(/px|em|rem|%/)) {
            return Math.round(lineHeightNum * fontSizeValue);
          } else {
            // Already has units, parse as pixels
            return parseCSSValue(lineHeightValue).num;
          }
        })(),
        lineHeightUnit: 'px',
      });
      
      setHasChanges(false);
    }
  }, [selectedElement]);

  useEffect(() => {
    if (selectedElement) {
      const textChanged = editedText !== (selectedElement.textContent || '');
      const classChanged = editedClassName !== (selectedElement.className || '');
      
      // Check if styles changed by comparing with original computed styles
      const computed = selectedElement.computedStyles || {};
      const originalColor = rgbToHex(computed.color || '#000000');
      const originalBg = computed.backgroundColor === 'rgba(0, 0, 0, 0)' || !computed.backgroundColor 
        ? 'transparent' 
        : rgbToHex(computed.backgroundColor);
      const originalFontSize = parseCSSValue(computed.fontSize || '16px');
      const originalMarginTop = parseCSSValue(computed.marginTop || '0px');
      const originalPaddingTop = parseCSSValue(computed.paddingTop || '0px');
      
      const stylesChanged = 
        styles.color !== originalColor ||
        styles.backgroundColor !== originalBg ||
        styles.fontSize !== originalFontSize.num ||
        styles.fontSizeUnit !== originalFontSize.unit ||
        styles.fontWeight !== (computed.fontWeight || '400') ||
        styles.fontFamily !== (computed.fontFamily?.replace(/['"]/g, '').split(',')[0].trim() || 'inherit') ||
        styles.marginTop !== originalMarginTop.num ||
        styles.marginRight !== parseCSSValue(computed.marginRight || '0px').num ||
        styles.marginBottom !== parseCSSValue(computed.marginBottom || '0px').num ||
        styles.marginLeft !== parseCSSValue(computed.marginLeft || '0px').num ||
        styles.marginUnit !== originalMarginTop.unit ||
        styles.paddingTop !== originalPaddingTop.num ||
        styles.paddingRight !== parseCSSValue(computed.paddingRight || '0px').num ||
        styles.paddingBottom !== parseCSSValue(computed.paddingBottom || '0px').num ||
        styles.paddingLeft !== parseCSSValue(computed.paddingLeft || '0px').num ||
        styles.paddingUnit !== originalPaddingTop.unit ||
        styles.textAlign !== (computed.textAlign || 'left') ||
        (() => {
          const computedLineHeight = computed.lineHeight || '1.5';
          const fontSizeValue = parseCSSValue(computed.fontSize || '16px').num;
          const computedLineHeightNum = parseFloat(computedLineHeight);
          const computedLineHeightPx = computedLineHeight.match(/px|em|rem|%/) 
            ? parseCSSValue(computedLineHeight).num 
            : Math.round(computedLineHeightNum * fontSizeValue);
          return Math.abs(styles.lineHeight - computedLineHeightPx) > 0.5; // 0.5px tolerance
        })();
      
      setHasChanges(textChanged || classChanged || stylesChanged);
    }
  }, [editedText, editedClassName, selectedElement, styles]);

  if (!selectedElement) {
    return (
      <Card
        size="small"
        style={{
          position: 'absolute',
          top: 60,
          right: 16,
          width: 320,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: 8,
          zIndex: 1000,
        }}
      >
        <Flex align="center" justify="center" style={{ padding: 24 }}>
          <Text type="secondary">Click an element in the preview to edit</Text>
        </Flex>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!selectedElement || !hasChanges) return;

    setIsSaving(true);
    try {
      const file = projectFiles.find(f => f.path === selectedElement.filePath);
      if (!file) {
        message.error('File not found');
        return;
      }

      let fileContent = file.content;
      let targetFile = file;
      let modified = false;
      const oldText = selectedElement.textContent.trim();
      const newText = editedText.trim();
      const isComponentFile = selectedElement.filePath.includes('/components/');

      // Normalize whitespace for comparison
      const normalizeWhitespace = (str: string): string => {
        return str.replace(/\s+/g, ' ').trim();
      };

      // Escape special regex characters
      const escapeRegex = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };

      // Helper function to search and replace text in a file
      const searchAndReplace = (content: string, text: string, replacement: string): { found: boolean; newContent: string } => {
        // Normalize both text and content for comparison
        const normalizedText = normalizeWhitespace(text);
        const normalizedReplacement = replacement.trim();
        
        // Escape the text for regex, but preserve whitespace patterns
        const escapedText = escapeRegex(text);
        const escapedNormalizedText = escapeRegex(normalizedText);
        
        // Strategy 1: JSX children - text between > and < (most common case)
        // Handles: <div>text</div>, <div>  text  </div>, <div>\n  text  \n</div>
        const jsxChildrenPatterns = [
          // Inline: >text< or > text <
          new RegExp(`(>\\s*)${escapedText}(\\s*<)`, 'g'),
          // With newlines: >\n  text  \n<
          new RegExp(`(>\\s*\\n\\s*)${escapedText}(\\s*\\n\\s*<)`, 'g'),
          // Normalized whitespace version (more flexible)
          new RegExp(`(>\\s*)${escapedNormalizedText.replace(/\\ /g, '\\s+')}(\\s*<)`, 'g'),
        ];

        for (const pattern of jsxChildrenPatterns) {
          if (pattern.test(content)) {
            pattern.lastIndex = 0;
            // Replace while preserving JSX structure
            const newContent = content.replace(pattern, (match, before, after) => {
              return before + normalizedReplacement + after;
            });
            return { found: true, newContent };
          }
        }

        // Strategy 2: String literals in JSX attributes or variables
        // Handles: title="text", title='text', const str = "text"
        const stringLiteralPatterns = [
          // Double quotes
          new RegExp(`(")${escapedText}\\1`, 'g'),
          // Single quotes
          new RegExp(`(')${escapedText}\\1`, 'g'),
          // Template literals (backticks)
          new RegExp(`(\`)${escapedText}\\1`, 'g'),
        ];

        for (const pattern of stringLiteralPatterns) {
          if (pattern.test(content)) {
            pattern.lastIndex = 0;
            const newContent = content.replace(pattern, (match, quote) => {
              return quote + normalizedReplacement + quote;
            });
            return { found: true, newContent };
          }
        }

        // Strategy 3: JSX with component tags
        // Handles: <CardTitle>text</CardTitle>, <h1>text</h1>
        const jsxTagPattern = new RegExp(`(<[^>]+>\\s*)${escapedText}(\\s*</[^>]+>)`, 'g');
        if (jsxTagPattern.test(content)) {
          jsxTagPattern.lastIndex = 0;
          const newContent = content.replace(jsxTagPattern, `$1${normalizedReplacement}$2`);
          return { found: true, newContent };
        }

        // Strategy 4: Text in template literals with expressions
        // Handles: `prefix ${var} text suffix`
        const templateLiteralPattern = new RegExp(`(\`[^\`]*?)\\${escapedText}([^\`]*?\`)`, 'g');
        if (templateLiteralPattern.test(content)) {
          templateLiteralPattern.lastIndex = 0;
          const newContent = content.replace(templateLiteralPattern, `$1${normalizedReplacement}$2`);
          return { found: true, newContent };
        }

        // Strategy 5: Whitespace-normalized search
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const normalizedLine = normalizeWhitespace(lines[i]);
          if (normalizedLine.includes(normalizedText)) {
            // Try to preserve original formatting while replacing
            const linePattern = new RegExp(escapeRegex(text).replace(/\\ /g, '\\s+'), 'g');
            if (linePattern.test(lines[i])) {
              linePattern.lastIndex = 0;
              lines[i] = lines[i].replace(linePattern, normalizedReplacement);
              return { found: true, newContent: lines.join('\n') };
            }
          }
        }

        // Strategy 6: Exact match fallback
        if (content.includes(text)) {
          // Only replace if it's a standalone occurrence
          const wordBoundaryPattern = new RegExp(`\\b${escapedText}\\b`, 'g');
          if (wordBoundaryPattern.test(content)) {
            wordBoundaryPattern.lastIndex = 0;
            return { found: true, newContent: content.replace(wordBoundaryPattern, normalizedReplacement) };
          }
          // If no word boundaries, do simple replace
          return { found: true, newContent: content.replace(text, normalizedReplacement) };
        }

        return { found: false, newContent: content };
      };

      // Strategy 1: Try to find and replace text in the current file
      if (editedText !== selectedElement.textContent && oldText) {
        const result = searchAndReplace(fileContent, oldText, newText);
        if (result.found) {
          fileContent = result.newContent;
          modified = true;
        }

        // Strategy 2: If it's a component file and text not found, search in other files
        if (!modified && isComponentFile && oldText) {
          // Search in page files and index files
          const likelyFiles = projectFiles.filter(f => 
            f.path.includes('/pages/') || 
            f.path.includes('/app/') || 
            f.path.includes('index.tsx') || 
            f.path.includes('index.ts') ||
            f.path === 'src/pages/index.tsx' ||
            f.path === 'src/app/page.tsx'
          );

          for (const candidateFile of likelyFiles) {
            if (candidateFile.path === file.path) continue; // Skip already searched file
            
            const result = searchAndReplace(candidateFile.content, oldText, newText);
            if (result.found) {
              // Update the candidate file
              const updatedFiles = projectFiles.map(f => 
                f.path === candidateFile.path 
                  ? { ...f, content: result.newContent }
                  : f
              );
              onSave(updatedFiles);
              message.success('Changes applied! Click Save to deploy.');
              setHasChanges(false);
              onClose();
              return;
            }
          }

          // Strategy 3: Search all files if still not found
          if (!modified) {
            for (const candidateFile of projectFiles) {
              if (candidateFile.path === file.path) continue;
              
              const result = searchAndReplace(candidateFile.content, oldText, newText);
              if (result.found) {
                const updatedFiles = projectFiles.map(f => 
                  f.path === candidateFile.path 
                    ? { ...f, content: result.newContent }
                    : f
                );
                onSave(updatedFiles);
                message.success('Changes applied! Click Save to deploy.');
                setHasChanges(false);
                onClose();
                return;
              }
            }
          }
        }
      }

      // Apply style changes and className changes
      const lines = fileContent.split('\n');
      const lineIndex = selectedElement.lineNumber - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        let line = lines[lineIndex];
        
        // Build JSX style object from edited properties
        const styleObj: Record<string, string> = {};
        
        if (styles.color !== '#000000') {
          styleObj.color = styles.color;
        }
        if (styles.backgroundColor && styles.backgroundColor !== 'transparent') {
          styleObj.backgroundColor = styles.backgroundColor;
        }
        if (styles.fontSize !== 16 || styles.fontSizeUnit !== 'px') {
          styleObj.fontSize = `${styles.fontSize}${styles.fontSizeUnit}`;
        }
        if (styles.fontWeight !== '400') {
          styleObj.fontWeight = styles.fontWeight;
        }
        if (styles.fontFamily && styles.fontFamily !== 'inherit') {
          styleObj.fontFamily = styles.fontFamily;
        }
        
        // Margin
        if (styles.marginTop !== 0 || styles.marginRight !== 0 || 
            styles.marginBottom !== 0 || styles.marginLeft !== 0) {
          if (styles.marginTop === styles.marginRight && 
              styles.marginRight === styles.marginBottom && 
              styles.marginBottom === styles.marginLeft) {
            styleObj.margin = `${styles.marginTop}${styles.marginUnit}`;
          } else {
            styleObj.margin = `${styles.marginTop}${styles.marginUnit} ${styles.marginRight}${styles.marginUnit} ${styles.marginBottom}${styles.marginUnit} ${styles.marginLeft}${styles.marginUnit}`;
          }
        }
        
        // Padding
        if (styles.paddingTop !== 0 || styles.paddingRight !== 0 || 
            styles.paddingBottom !== 0 || styles.paddingLeft !== 0) {
          if (styles.paddingTop === styles.paddingRight && 
              styles.paddingRight === styles.paddingBottom && 
              styles.paddingBottom === styles.paddingLeft) {
            styleObj.padding = `${styles.paddingTop}${styles.paddingUnit}`;
          } else {
            styleObj.padding = `${styles.paddingTop}${styles.paddingUnit} ${styles.paddingRight}${styles.paddingUnit} ${styles.paddingBottom}${styles.paddingUnit} ${styles.paddingLeft}${styles.paddingUnit}`;
          }
        }
        
        if (styles.textAlign !== 'left') {
          styleObj.textAlign = styles.textAlign;
        }
        // Line height is always in pixels now
        const defaultLineHeight = Math.round(styles.fontSize * 1.5); // Default is 1.5x font size
        if (styles.lineHeight !== defaultLineHeight) {
          styleObj.lineHeight = `${styles.lineHeight}${styles.lineHeightUnit}`;
        }
        
        // Convert style object to JSX format: style={{ key: 'value', ... }}
        const styleEntries = Object.entries(styleObj);
        const newStyleAttr = styleEntries.length > 0 
          ? ` style={{${styleEntries.map(([key, value]) => {
              // fontWeight can be a number in JSX
              if (key === 'fontWeight' && /^\d+$/.test(value)) {
                return ` ${key}: ${value}`;
              }
              // Escape single quotes and backslashes in string values
              const escapedValue = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return ` ${key}: '${escapedValue}'`;
            }).join(',')} }}`
          : '';
        
        // Update or add style attribute - handle both JSX style={{...}} and HTML style="..."
        // First try JSX style object format (more flexible regex to handle nested braces)
        const jsxStyleRegex = /\s+style=\{\{[^}]*\}\}/;
        const htmlStyleRegex = /\s+style=["']([^"']*)["']/;
        
        if (jsxStyleRegex.test(line)) {
          // Replace existing JSX style object
          if (newStyleAttr) {
            line = line.replace(jsxStyleRegex, newStyleAttr);
          } else {
            line = line.replace(jsxStyleRegex, '');
          }
          modified = true;
        } else if (htmlStyleRegex.test(line)) {
          // Replace existing HTML style string with JSX format
          if (newStyleAttr) {
            line = line.replace(htmlStyleRegex, newStyleAttr);
          } else {
            line = line.replace(htmlStyleRegex, '');
          }
          modified = true;
        } else if (newStyleAttr) {
          // Add style attribute
          const tagMatch = line.match(/<(\w+)([^>]*)>/);
          if (tagMatch) {
            line = line.replace(`<${tagMatch[1]}${tagMatch[2]}`, `<${tagMatch[1]}${tagMatch[2]}${newStyleAttr}`);
            modified = true;
          }
        }
        
        // Update className if changed
        if (editedClassName !== (selectedElement.className || '')) {
          const classNameRegex = /className=["']([^"']*)["']/;
          if (classNameRegex.test(line)) {
            line = line.replace(classNameRegex, `className="${editedClassName}"`);
          } else if (editedClassName) {
            const tagMatch = line.match(/<(\w+)([^>]*)>/);
            if (tagMatch) {
              line = line.replace(`<${tagMatch[1]}${tagMatch[2]}`, `<${tagMatch[1]}${tagMatch[2]} className="${editedClassName}"`);
            }
          }
          modified = true;
        }
        
        if (modified) {
          lines[lineIndex] = line;
          fileContent = lines.join('\n');
        }
      }

      if (!modified) {
        message.warning(
          'Could not find the exact text to modify. This might be a component that renders dynamic content (props/children). Try editing the code directly.'
        );
        return;
      }

      const updatedContent = fileContent;

      const updatedFiles = projectFiles.map(f => 
        f.path === selectedElement.filePath 
          ? { ...f, content: updatedContent }
          : f
      );

      onSave(updatedFiles);
      message.success('Changes applied! Click Save to deploy.');
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Error applying visual edit:', error);
      message.error('Failed to apply changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      size="small"
      title={
        <Flex align="center" gap={8}>
          <EditOutlined style={{ color: '#5345F3' }} />
          <Text strong>Visual Edit</Text>
        </Flex>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      }
      style={{
        position: 'absolute',
        top: 60,
        right: 16,
        width: 400,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: 8,
        zIndex: 1000,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
      }}
      styles={{ body: { padding: 16 } }}
    >
      {/* Element Info */}
      {selectedElement.id && (
        <Flex gap={4} wrap="wrap" style={{ marginBottom: 12 }}>
          <Tag color="green">#{selectedElement.id}</Tag>
        </Flex>
      )}

      {selectedElement.filePath.includes('/components/') && (
        <Tag color="orange" style={{ marginBottom: 12, fontSize: 11 }}>
          ⚠️ Component file - text may come from props
        </Tag>
      )}

      {/* Text Content Editor */}
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Text Content
          </Text>
          <TextArea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            placeholder="Enter text content..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Typography */}
        <div>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Typography
          </Text>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Color:</Text>
              <ColorPicker
                value={styles.color || '#000000'}
                onChange={(color) => setStyles({ ...styles, color: color.toHexString() })}
                showText
                size="small"
                style={{ flex: 1 }}
              />
            </Flex>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Background:</Text>
              <ColorPicker
                value={styles.backgroundColor === 'transparent' ? '#ffffff' : (styles.backgroundColor || '#ffffff')}
                onChange={(color) => {
                  const hexColor = color.toHexString();
                  setStyles({ ...styles, backgroundColor: hexColor });
                }}
                showText
                size="small"
                style={{ flex: 1 }}
              />
              <Button
                size="small"
                type={styles.backgroundColor === 'transparent' ? 'primary' : 'default'}
                onClick={() => {
                  setStyles({ 
                    ...styles, 
                    backgroundColor: styles.backgroundColor === 'transparent' ? '#ffffff' : 'transparent' 
                  });
                }}
              >
                {styles.backgroundColor === 'transparent' ? 'Transparent' : 'Set Transparent'}
              </Button>
            </Flex>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Font Size:</Text>
              <InputNumber
                value={styles.fontSize}
                onChange={(val) => setStyles({ ...styles, fontSize: val || 16 })}
                min={8}
                max={72}
                size="small"
                style={{ flex: 1 }}
              />
              <Select
                value={styles.fontSizeUnit}
                onChange={(val) => setStyles({ ...styles, fontSizeUnit: val })}
                size="small"
                style={{ width: 70 }}
                options={[
                  { label: 'px', value: 'px' },
                  { label: 'em', value: 'em' },
                  { label: 'rem', value: 'rem' },
                ]}
              />
            </Flex>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Font Weight:</Text>
              <Select
                value={styles.fontWeight}
                onChange={(val) => setStyles({ ...styles, fontWeight: val })}
                size="small"
                style={{ flex: 1 }}
                options={[
                  { label: 'Normal (400)', value: '400' },
                  { label: 'Bold (700)', value: '700' },
                  { label: 'Light (300)', value: '300' },
                  { label: 'Medium (500)', value: '500' },
                ]}
              />
            </Flex>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Font Family:</Text>
              <Input
                value={styles.fontFamily}
                onChange={(e) => setStyles({ ...styles, fontFamily: e.target.value })}
                placeholder="e.g., Arial, sans-serif"
                size="small"
                style={{ flex: 1 }}
              />
            </Flex>
            <Flex gap={8} align="center">
              <Text style={{ width: 80, fontSize: 11 }}>Line Height:</Text>
              <InputNumber
                value={styles.lineHeight}
                onChange={(val) => setStyles({ ...styles, lineHeight: val || Math.round(styles.fontSize * 1.5) })}
                min={8}
                max={200}
                size="small"
                style={{ flex: 1 }}
              />
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>px</Text>
            </Flex>
          </Space>
        </div>

        {/* Spacing - Margin */}
        <div style={{ wordBreak: 'keep-all', display: 'flex', gap: 32 }}>
          <Text strong style={{ fontSize: 12, display: 'block', wordBreak: 'keep-all' }}>
            Margin
          </Text>
          <Flex gap={4} align="center" style={{ flexWrap: 'nowrap', width: '100%' }}>
            <InputNumber
              value={styles.marginTop}
              onChange={(val) => setStyles({ ...styles, marginTop: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.marginRight}
              onChange={(val) => setStyles({ ...styles, marginRight: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.marginBottom}
              onChange={(val) => setStyles({ ...styles, marginBottom: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.marginLeft}
              onChange={(val) => setStyles({ ...styles, marginLeft: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <Select
              value={styles.marginUnit}
              onChange={(val) => setStyles({ ...styles, marginUnit: val })}
              size="small"
              style={{ width: 60, flexShrink: 0 }}
              options={[
                { label: 'px', value: 'px' },
                { label: 'em', value: 'em' },
                { label: 'rem', value: 'rem' },
              ]}
            />
          </Flex>
        </div>

        {/* Spacing - Padding */}
        <div style={{ wordBreak: 'keep-all', display: 'flex', gap: 24 }}>
          <Text strong style={{ fontSize: 12, display: 'block', wordBreak: 'keep-all' }}>
            Padding
          </Text>
          <Flex gap={4} align="center" style={{ flexWrap: 'nowrap', width: '100%' }}>
            <InputNumber
              value={styles.paddingTop}
              onChange={(val) => setStyles({ ...styles, paddingTop: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.paddingRight}
              onChange={(val) => setStyles({ ...styles, paddingRight: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.paddingBottom}
              onChange={(val) => setStyles({ ...styles, paddingBottom: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <InputNumber
              value={styles.paddingLeft}
              onChange={(val) => setStyles({ ...styles, paddingLeft: val || 0 })}
              size="small"
              style={{ width: 50, flexShrink: 0 }}
              min={0}
              controls={false}
            />
            <Select
              value={styles.paddingUnit}
              onChange={(val) => setStyles({ ...styles, paddingUnit: val })}
              size="small"
              style={{ width: 60, flexShrink: 0 }}
              options={[
                { label: 'px', value: 'px' },
                { label: 'em', value: 'em' },
                { label: 'rem', value: 'rem' },
              ]}
            />
          </Flex>
        </div>

      </Space>

      <Divider style={{ margin: '16px 0 12px' }} />

      <Flex gap={8}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
          style={{ flex: 1 }}
        >
          Apply Changes
        </Button>
        {onDeploy && (
          <Button
            icon={<ReloadOutlined />}
            onClick={onDeploy}
            title="Save and redeploy to Vercel"
          >
            Deploy
          </Button>
        )}
      </Flex>

      {hasChanges && (
        <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          You have unsaved changes
        </Text>
      )}
    </Card>
  );
}

