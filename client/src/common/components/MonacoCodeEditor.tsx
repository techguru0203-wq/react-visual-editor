import React, { useEffect, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoCodeEditorProps {
  value?: string;
  onUpdate?: (content: string) => void;
  style?: React.CSSProperties;
  editable?: boolean;
  language?: 'html' | 'tsx' | 'css' | 'md' | 'json' | 'sql';
}

// Map language string to Monaco language
function getMonacoLanguage(language?: string): string {
  switch (language) {
    case 'tsx':
      return 'typescript';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'json':
      return 'json';
    case 'sql':
      return 'sql';
    case 'html':
    default:
      return 'html';
  }
}

const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  value = '',
  onUpdate,
  style,
  editable = true,
  language = 'html',
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);

  // Update valueRef when value changes externally
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    // Disable TypeScript/JavaScript diagnostics to avoid showing module resolution errors
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });

    // Configure Monaco options
    editor.updateOptions({
      readOnly: !editable,
      minimap: { enabled: true },
      lineNumbers: 'on',
      wordWrap: 'on',
      formatOnPaste: true,
      formatOnType: true,
      autoIndent: 'full',
      scrollBeyondLastLine: false,
      fontSize: 14,
      tabSize: 2,
      padding: { top: 0, bottom: 0 },
      glyphMargin: false, // Remove left margin for breakpoints/icons
      folding: true, // Keep code folding
      lineDecorationsWidth: 0, // Remove line decorations width
      lineNumbersMinChars: 3, // Minimum characters for line numbers
    });
  };

  const handleEditorChange = (newValue: string | undefined) => {
    const content = newValue || '';
    if (content !== valueRef.current) {
      valueRef.current = content;
      onUpdate?.(content);
    }
  };

  // Extract height-related styles from style prop to avoid conflicts
  const { height, minHeight, maxHeight, overflow, ...restStyle } = style || {};

  // Use explicit height if provided, otherwise use 100%
  // Prefer height, then minHeight, then maxHeight, then default to 100%
  const containerHeight = height || minHeight || maxHeight || '100%';
  const containerOverflow = overflow || 'hidden';

  // For Monaco Editor, use numeric height if available
  // If minHeight or maxHeight is provided as a number, use that
  const editorHeight =
    typeof height === 'number'
      ? height
      : typeof minHeight === 'number'
        ? minHeight
        : typeof maxHeight === 'number'
          ? maxHeight
          : '100%';

  return (
    <div
      style={{
        height: containerHeight,
        minHeight,
        maxHeight,
        overflow: containerOverflow,
        ...restStyle,
      }}
    >
      <Editor
        height={editorHeight}
        language={getMonacoLanguage(language)}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-light"
        options={{
          readOnly: !editable,
          minimap: { enabled: true },
          lineNumbers: 'on',
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
          scrollBeyondLastLine: false,
          fontSize: 14,
          tabSize: 2,
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
        }}
      />
    </div>
  );
};

export default MonacoCodeEditor;
