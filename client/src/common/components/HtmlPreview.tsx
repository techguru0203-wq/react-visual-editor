import React, { useCallback, useEffect, useRef } from 'react';

import './HtmlEditor.scss';

interface HtmlEditorProps {
  content?: string;
  onUpdate?: (content: string) => void;
}

const HtmlPreview: React.FC<HtmlEditorProps> = ({ content = '', onUpdate }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isValidURL = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const isImageURL = (url: string) => {
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);
  };

  const updatePreview = useCallback((content: string) => {
    const previewFrame = iframeRef.current;
    if (previewFrame) {
      const preview =
        previewFrame.contentDocument || previewFrame.contentWindow?.document;
      if (preview) {
        preview.open();
        try {
          preview.write(content);
          const viewportMeta = preview.createElement('meta');
          viewportMeta.name = 'viewport';
          viewportMeta.content = 'width=device-width, initial-scale=1';
          preview.head && preview.head.appendChild(viewportMeta);
          console.log(preview);
        } catch (error) {
          console.error('Error updating preview:', error);
        } finally {
          preview.close();
        }
      }
    }
  }, []);

  const handleUpdate = useCallback(
    (content: string) => {
      const previewFrame = iframeRef.current;
      if (previewFrame) {
        if (isValidURL(content)) {
          if (isImageURL(content)) {
            const imageContent = `<html><head><style>body{margin:0;padding:0;}img{width:100%;height:auto;display:block;}</style></head><body><img src="${content}" alt="Image" /></body></html>`;
            updatePreview(imageContent);
          } else {
            previewFrame.src = content;
          }
        } else {
          updatePreview(content || '');
        }
      }
      if (onUpdate) {
        onUpdate(content);
      }
    },
    [onUpdate, updatePreview]
  );

  useEffect(() => {
    handleUpdate(content);
  }, [content, handleUpdate]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
      }}
    >
      <iframe ref={iframeRef} className="text-preview" title="Preview"></iframe>
    </div>
  );
};
export default HtmlPreview;
