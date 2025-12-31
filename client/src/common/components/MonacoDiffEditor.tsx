import React, { useRef, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoDiffEditorProps {
  originalValue: string;
  modifiedValue: string;
  language?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
  originalTitle?: string;
  modifiedTitle?: string;
}

// Map language string to Monaco language
function getMonacoLanguage(language?: string): string {
  switch (language) {
    case 'tsx':
    case 'ts':
    case 'jsx':
    case 'js':
      return 'typescript';
    case 'css':
      return 'css';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
    default:
      return 'html';
  }
}

const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({
  originalValue,
  modifiedValue,
  language = 'typescript',
  readOnly = true,
  style,
}) => {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneDiffEditor) => {
    editorRef.current = editor;
  };

  // Cleanup editor properly on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        try {
          // Safely dispose the editor
          editorRef.current.dispose();
          editorRef.current = null;
        } catch (error) {
          // Silently catch dispose errors
          console.debug('Editor already disposed');
        }
      }
    };
  }, []);

  return (
    <div style={{ height: '100%', overflow: 'hidden', ...style }}>
      <DiffEditor
        height="100%"
        language={getMonacoLanguage(language)}
        original={originalValue}
        modified={modifiedValue}
        theme="vs-light"
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          renderSideBySide: true,
          enableSplitViewResizing: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontSize: 14,
          renderOverviewRuler: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
        }}
      />
    </div>
  );
};

export default MonacoDiffEditor;
