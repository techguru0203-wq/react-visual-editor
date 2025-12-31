import React, { useState } from 'react';
import { CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { Access, DOCTYPE } from '@prisma/client';
import { Button, Flex, Input, message, Upload } from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useNavigate } from 'react-router';

import ProjectStep from '../../../common/components/ProjectStep';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import trackEvent from '../../../trackingClient';
import { useAddProjectMutation } from '../../project/hooks/useProjectMutation';

import './OmniflowWelcome.scss';

interface UploadFileWithContent extends UploadFile<any> {
  content?: string;
}

export const OmniflowWelcome: React.FC = () => {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [fileList, setFileList] = useState<UploadFileWithContent[]>([]);
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const { createProjectMutation } = useAddProjectMutation({
    onSuccess: (project) => {
      setIsSaving(false);
      let prd = project.documents.find((doc) => doc.type === DOCTYPE.PRD);
      if (prd) {
        navigate(`/docs/${prd.id}`, {
          state: { autoCollapseSidepanel: true },
        });
      }
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  const onSave = () => {
    createProjectMutation.mutate({
      name: '', // TO BE FIXED
      description,
      access: Access.SELF,
      ownerUserId: user?.id,
    });
    setIsSaving(true);
    trackEvent('startProjectClientClicked', {
      description,
      ownerUserId: user?.id,
    });
  };

  const beforeUpload = (file: File) => {
    const isAllowed =
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'text/plain';
    if (!isAllowed) {
      message.error('You can only upload PDF, Word, or text files!');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileList([
        {
          uid: `${Date.now()}-${Math.random()}`,
          name: file.name,
          status: 'done',
          originFileObj: file as RcFile,
          content: e.target?.result as string,
        },
      ]);
    };
    if (file.type === 'application/pdf' || file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    return false;
  };

  return (
    <div className="omniflow-welcome-bg">
      <div className="omniflow-welcome-container">
        <ProjectStep />
        <div
          className="omniflow-welcome-chatbox"
          style={{ position: 'relative' }}
        >
          <Input.TextArea
            placeholder={t('home.whatToBuildToday')}
            autoSize={{ minRows: 5, maxRows: 8 }}
            className="omniflow-welcome-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ paddingBottom: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              display: 'flex',
              alignItems: 'center',
              zIndex: 2,
            }}
          >
            <Upload
              accept=".pdf,.doc,.docx,.txt"
              beforeUpload={beforeUpload}
              fileList={fileList}
              showUploadList={false}
              onRemove={() => {
                setFileList([]);
              }}
              maxCount={1}
            >
              <UploadOutlined
                style={{
                  fontSize: 22,
                  color: '#426CDA',
                  cursor: 'pointer',
                  marginRight: 8,
                }}
              />
            </Upload>
            {fileList.map((file) => (
              <span
                key={file.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: 8,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 13,
                }}
              >
                {file.name}
                <CloseOutlined
                  style={{ marginLeft: 4, color: '#888', cursor: 'pointer' }}
                  onClick={() => {
                    setFileList((prev) =>
                      prev.filter((f) => f.uid !== file.uid)
                    );
                  }}
                />
              </span>
            ))}
          </div>
        </div>
        <Flex gap={8} justify="center" className="omniflow-welcome-actions">
          <Button shape="round">{t('home.buildMobileApp')}</Button>
          <Button shape="round">{t('home.startBlog')}</Button>
          <Button shape="round">{t('home.scaffoldUI')}</Button>
        </Flex>
        <Flex style={{ marginTop: '15px', justifyContent: 'center' }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isSaving}
            onClick={onSave}
          >
            Go
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default OmniflowWelcome;
