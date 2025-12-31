import { useCallback, useEffect, useState } from 'react';
import { TemplateDocument } from '@prisma/client';
import { Drawer, Flex, message } from 'antd';
import Sider from 'antd/es/layout/Sider';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { getFormHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { DevPlanOutput } from '../../devPlans/types/devPlanTypes';
import { ProjectFile } from '../../project/components/prototype/PrototypeEditor';
import { TemplateCenterModal } from '../../templateDocument/components/TemplateCenterModal';
import { DocumentOutput, TemplateDocumentOutput } from '../types/documentTypes';
import { DocHistoryItem } from './DocumentEditor';

import './EditorSidebar.scss';

interface EditorSidebarProps {
  document: DocumentOutput | DevPlanOutput;
  form: any;
  refetchDocument?: () => void;
  isDocFullScreen?: boolean;
  setIsDocFullScreen?: any;
  selectedTemplate?: TemplateDocumentOutput | null;
  onClickTemplateIcon?: () => void;
  setActiveHistory?: (value: DocHistoryItem | null) => void;
  setSelectTemplate?: (value: TemplateDocument | null) => void;
  setProjectFiles?: (files: ProjectFile[]) => void;
  setPrototypeSourceUrl?: (url: string) => void;
  setLocalDoc?: (doc: any) => void;
  children?: React.ReactNode;
}

const sideEditorWidthKey = 'sideEditorWidth';

export default function EditorSidebar({
  document,
  form,
  isDocFullScreen,
  setIsDocFullScreen,
  setActiveHistory,
  refetchDocument,
  setSelectTemplate,
  setProjectFiles,
  setPrototypeSourceUrl,
  children,
}: EditorSidebarProps) {
  const [templateCenterOpen, setTemplateCenterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useCurrentUser();

  const [editorSidebarWidth, setEditorSidebarWidth] = useState(
    window.localStorage.getItem(sideEditorWidthKey) || '45%'
  );

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 575);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const handleHistoryChange = useCallback(
    async (item: DocHistoryItem, versionNumber: number) => {
      setActiveHistory?.(item);

      if (document?.type === 'PRD') {
        form.setFieldsValue({
          description: item?.description,
          contents: item?.content,
        });
      } else if (
        document?.type === 'PROTOTYPE' ||
        document?.type === 'PRODUCT'
      ) {
        if (item.fileUrl) {
          // console.log(item.fileUrl);
          const prefix = 'source-code/';
          const index = item.fileUrl.indexOf(prefix);
          const key = index !== -1 ? item.fileUrl.substring(index) : '';
          const headers = await getFormHeaders();
          try {
            const res = await fetch(
              `${api_url}/api/s3FileService/fetch-code?key=${key}`,
              {
                method: 'GET',
                headers: headers,
                credentials: 'include',
                cache: 'reload',
              }
            );
            const result = await res.json();

            if (result.success) {
              setProjectFiles?.(result.data.files);
              setPrototypeSourceUrl?.(item.currentVersionUrl);
            } else {
              message.error('Error fetching history versions.');
            }
          } catch (error) {
            console.error('Error fetching prototype history:', error);
            message.error('Error loading prototype history.');
          }
        }
      }

      // track event
      trackEvent('viewDocHistory', {
        distinct_id: user.email,
        payload: JSON.stringify({
          documentId: document.id,
          documentType: document?.type,
          name: document?.name,
          versionNumber,
        }),
      });
    },
    [
      document,
      form,
      setActiveHistory,
      user.email,
      setProjectFiles,
      setPrototypeSourceUrl,
    ]
  );

  const SidebarContent = (
    <>
      <Flex
        vertical
        gap={2}
        style={{
          padding: '10px 10px 0',
          minHeight: '100%',
          height: '100%',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Flex
          justify="space-between"
          vertical
          gap={2}
          style={{ marginBottom: 10 }}
        >
          <TemplateCenterModal
            open={templateCenterOpen}
            onClose={function (): void {
              setTemplateCenterOpen(false);
            }}
            onUseTemplate={function (template: TemplateDocument): void {
              setSelectTemplate?.(template);
            }}
          />
        </Flex>
        {children}
      </Flex>
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          open={isDocFullScreen}
          placement="right"
          onClose={() => setIsDocFullScreen(!isDocFullScreen)}
          styles={{
            body: { padding: 0 },
            header: {
              position: 'absolute',
              top: '12px',
              left: '12px',
              border: 'none',
              padding: '0',
              zIndex: 9999,
            },
          }}
          style={{
            overflow: 'hidden',
            paddingBottom: '8px',
            backgroundColor: '#F4F6FB',
          }}
        >
          {SidebarContent}
        </Drawer>
      ) : (
        <Sider
          width={editorSidebarWidth}
          theme="light"
          className="editor-side-bar-container"
          style={{
            flex: 1,
            overflow: 'hidden',
            paddingBottom: '10px',
            backgroundColor: '#F4F6FB',
            borderInlineStart: '1px solid rgba(5,5,5,0.06)',
            display: isDocFullScreen ? 'none' : 'flex',
          }}
        >
          {SidebarContent}
        </Sider>
      )}
    </>
  );
}
