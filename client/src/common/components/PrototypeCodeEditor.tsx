import React from 'react';
import MonacoCodeEditor from './MonacoCodeEditor';

interface PrototypeCodeEditorProps {
  value?: string;
  onUpdate?: (content: string) => void;
  style?: React.CSSProperties;
  editable?: boolean;
  language?: 'html' | 'tsx' | 'css' | 'md' | 'json' | 'sql';
}

const PrototypeCodeEditor: React.FC<PrototypeCodeEditorProps> = ({
  value = '',
  onUpdate,
  style,
  editable = true,
  language = 'html',
}) => {
  return (
    <MonacoCodeEditor
      value={value}
      onUpdate={onUpdate}
      style={style}
      editable={editable}
      language={language}
    />
  );
};

export default PrototypeCodeEditor;
