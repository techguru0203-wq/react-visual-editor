import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useParams } from 'react-router-dom';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { getUploadedFileContent } from '../../api/protoTypeApi';
import ProjectView from './ProjectView';
import { ProjectFile } from './PrototypeEditor';

interface UploadedContent {
  files: ProjectFile[];
}

function PrototypePreview() {
  const params = useParams();
  const { docId } = params;
  const { t } = useLanguage();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFiles() {
      if (docId) {
        try {
          const content = await getUploadedFileContent(docId);
          console.log('getUploadedFileContent:', content);

          // Convert the content to the correct format
          const uploadedContent = content as UploadedContent;
          setFiles(uploadedContent.files);
        } catch (err) {
          console.error('Error fetching files:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }

    fetchFiles();
  }, [docId]);

  if (isLoading || !files.length) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Spin size="large" />
        <div>{t('prototypeEditor.loadingProjectPreview')}</div>
      </div>
    );
  }

  return (
    <div className="web-container-show" style={{ height: '100vh' }}>
      <ProjectView files={files} />
    </div>
  );
}

export default PrototypePreview;
