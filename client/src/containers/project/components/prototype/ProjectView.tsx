import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ProjectFile } from './PrototypeEditor';

interface ProjectPreviewProps {
  files?: ProjectFile[];
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({ files = [] }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [isCssLoaded, setIsCssLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper function to find files by extension
  const findFileByExtension = useCallback(
    (extension: string) => files.find((file) => file.path.endsWith(extension)),
    [files]
  );

  // Helper function to create and manage Blob URLs
  const createBlobUrl = (content: string, type: string): string => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    return url;
  };

  // Helper function to cleanup resources
  const cleanupResources = () => {
    // Cleanup Blob URLs
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    // Cleanup dynamically added elements
    const script = document.querySelector(`script[type="module"]`);
    const link = document.querySelector(`link[href^="blob:"]`);

    if (script) document.body.removeChild(script);
    if (link) document.head.removeChild(link);
  };

  useEffect(() => {
    try {
      setError(null);
      const htmlFile = findFileByExtension('.html');
      const jsFile = findFileByExtension('.js');
      const cssFile = findFileByExtension('.css');

      if (!htmlFile) {
        setError('No HTML file found in the project');
        return;
      }

      // Cleanup previous resources
      cleanupResources();

      // Load CSS file
      if (cssFile) {
        const cssUrl = createBlobUrl(cssFile.content, 'text/css');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;

        link.onload = () => {
          console.log('CSS loaded successfully:', cssFile.path);
          setIsCssLoaded(true);
        };

        link.onerror = () => {
          console.error('Failed to load CSS:', cssFile.path);
          setError('Failed to load CSS file');
        };

        document.head.appendChild(link);
      } else {
        setIsCssLoaded(true);
      }

      // Load JS file
      if (jsFile) {
        const jsUrl = createBlobUrl(jsFile.content, 'application/javascript');
        const script = document.createElement('script');
        script.type = 'module';
        script.src = jsUrl;

        script.onload = () => {
          console.log('JavaScript loaded successfully:', jsFile.path);
        };

        script.onerror = () => {
          console.error('Failed to load JavaScript:', jsFile.path);
          setError('Failed to load JavaScript file');
        };

        document.body.appendChild(script);
      }

      return cleanupResources;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
      console.error('Error in ProjectPreview: ', err);
    }
  }, [files, findFileByExtension]);

  useEffect(() => {
    if (isCssLoaded) {
      const htmlFile = findFileByExtension('.html');
      if (htmlFile) {
        setHtmlContent(htmlFile.content);
      }
    }
  }, [isCssLoaded, files, findFileByExtension]);

  if (error) {
    return (
      <div
        className="error-container"
        style={{ padding: '1rem', color: 'red' }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="project-preview-container"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.375rem',
        padding: '1rem',
        backgroundColor: '#ffffff',
        minHeight: '200px',
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default ProjectPreview;
