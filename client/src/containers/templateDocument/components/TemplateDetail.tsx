import { FC, useEffect, useRef, useState } from 'react';
import { CopyOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { TemplateAccess } from '@prisma/client';
import { Button, Flex, message, Typography } from 'antd';

import TiptapEditor from '../../../common/components/TiptapEditor';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import trackEvent from '../../../trackingClient';
import { useTemplateDocumentMutation } from '../hooks/useTemplateDocumentMutation';
import { TemplateDocumentItemType } from '../types/templateDocumentTypes';

import './TemplateDetail.scss';

export interface TemplateDetailProps {
  templateData: TemplateDocumentItemType;
  onUse?: (data: TemplateDocumentItemType) => void;
  onTemplateUpdated?: (updated: TemplateDocumentItemType) => void;
}

export const TemplateDetail: FC<TemplateDetailProps> = (props) => {
  const { templateData: template, onUse } = props;
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isClone, setIsClone] = useState(false);
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [prompt, setPrompt] = useState(template.promptText ?? '');
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>();

  const { addTemplateDocumentMutation } = useTemplateDocumentMutation({
    onSuccess: (templateDocument) => {
      console.log('Successfully created Template Document ', templateDocument);
      //Refresh the page
      props.onTemplateUpdated?.(templateDocument as TemplateDocumentItemType);
    },
    onError: () => {
      console.error('error');
    },
  });

  const { createTemplateCloneMutation } = useTemplateDocumentMutation({
    onSuccess: (templateDocument) => {
      console.log('Successfully cloned Template Document ', templateDocument);
      props.onTemplateUpdated?.(templateDocument as TemplateDocumentItemType);
      setIsEditing(true);
      setIsClone(true);
    },
    onError: () => {
      console.error('clone error');
    },
  });
  // measure the height of the editor
  useEffect(() => {
    if (!editorRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect) {
          setEditorHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && isClone && !name.endsWith(' (Clone)')) {
      setName((prev) => `${prev} (Clone)`);
    }
  }, [isEditing, isClone]);

  // track event
  trackEvent('TemplateDetail View', {
    distinct_id: user.email,
    payload: JSON.stringify({
      templateType: template.type,
      templateName: template.name,
      templateId: template.id,
      orgName: template.organization?.name,
    }),
  });
  let treeData;
  //Not sure if we use DOCTYPE.DEVELOPMENT_PLAN in the future, for now I just keep it commented out
  // if (template.type === DOCTYPE.DEVELOPMENT_PLAN) {
  //   treeData = JSON.parse(template.sampleOutputText as string);
  //   // 将treeData中的key值转换为string类型, 并保留children, title, key
  //   treeData = treeData.epics.map((epic: any) => ({
  //     ...epic,
  //     title: 'Epic: ' + epic.name,
  //     key: epic.key.toString(),
  //     children: epic.children.map((story: any) => ({
  //       ...story,
  //       title: 'Story: ' + story.name,
  //       key: story.key.toString(),
  //       // 将children中的key值转换为string类型
  //       children: story.children.map((task: any) => ({
  //         ...task,
  //         title: (
  //           <Flex vertical>
  //             <div>{task.name}</div>
  //             <div
  //               style={{
  //                 marginLeft: 20,
  //                 padding: 3,
  //               }}
  //             >
  //               {task.description}
  //             </div>
  //           </Flex>
  //         ),
  //         key: task.key.toString(),
  //       })),
  //     })),
  //   }));
  // }
  const handleUseTemplate = function () {
    onUse && onUse(template);
    // track event
    trackEvent('TemplateDetail Use', {
      distinct_id: user.email,
      payload: JSON.stringify({
        templateType: template.type,
        templateName: template.name,
        templateId: template.id,
        orgName: template.organization?.name,
      }),
    });
  };

  const handleEditTemplate = function () {
    if (
      template.creatorUserId !== user.id ||
      template.access === TemplateAccess.PUBLIC
    ) {
      message.warning(t('template.noPermissionEdit'));
      return;
    }
    setIsEditing(true);
  };

  const handleCloneTemplate = function () {
    const clonedName = `${template.name} (Clone)`;
    createTemplateCloneMutation.mutate({
      templateId: template.id,
      newName: clonedName,
    });
    message.info(t('template.clonedSuccessfully'));

    trackEvent('Template Cloned', {
      distinct_id: user.email,
      payload: JSON.stringify({
        originalTemplateId: template.id,
        newTemplateName: clonedName,
      }),
    });
  };

  const handleSaveTemplate = function () {
    setIsEditing(false);
    setIsClone(false);
    addTemplateDocumentMutation.mutate({
      id: template.id,
      name: name,
      description: description,
      access: TemplateAccess.SELF, // default set to self
      type: template.type,
      promptText: prompt,
      sampleOutputText: template.sampleOutputText,
      sampleInputText: template.sampleInputText,
    });
    message.info(t('template.updatedSuccessfully'));
    // track event
    trackEvent('Template Edited', {
      distinct_id: user.email,
      payload: JSON.stringify({
        templateId: template.id,
        templateType: template.type,
        newName: name,
        newDescription: description,
        newPromptText: prompt,
        sampleInputText: template.sampleInputText,
        sampleOutputText: template.sampleOutputText,
      }),
    });
  };
  return (
    <>
      <div style={{ marginTop: '24px' }}>
        <Flex style={{ flexWrap: 'wrap', marginBottom: '10px', gap: '12px' }}>
          {isEditing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                fontSize: 20,
                fontWeight: 500,
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: '6px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                width: `${Math.max(name.length, 10)}ch`,
                transition: 'all 0.2s ease-in-out',
              }}
            />
          ) : (
            <Typography.Title level={4} style={{ margin: 0 }}>
              {template.name}
            </Typography.Title>
          )}
          {onUse && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {isEditing ? (
                <Button
                  type="link"
                  onClick={handleSaveTemplate}
                  style={{ padding: 0 }}
                >
                  <SaveOutlined style={{ fontSize: 18 }} />
                  {t('template.save')}
                </Button>
              ) : (
                <Button
                  type="link"
                  onClick={handleEditTemplate}
                  style={{ padding: 0 }}
                >
                  <EditOutlined style={{ fontSize: 18 }} />
                  {t('template.edit')}
                </Button>
              )}
              <Button
                type="link"
                onClick={handleCloneTemplate}
                style={{ padding: 0 }}
              >
                <CopyOutlined style={{ fontSize: 18 }} />
                {t('template.clone')}
              </Button>
              <Button type="primary" onClick={handleUseTemplate}>
                {t('template.useTemplate')}
              </Button>
            </div>
          )}
        </Flex>
        <Typography.Text
          type="secondary"
          style={{ fontSize: '12px', margin: '5px 0 10px' }}
        >
          {t('template.by')} {template.organization?.name}
        </Typography.Text>
        {isEditing ? (
          <textarea
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              border: focused ? '1px solid #40a9ff' : '1px solid #d9d9d9',
              width: '100%',
              fontSize: 16,
              padding: '6px 12px',
              minHeight: 30,
              lineHeight: 1.5,
              borderRadius: 8,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <Typography.Paragraph style={{ margin: '10px 0', fontSize: 16 }}>
            {template.description}
          </Typography.Paragraph>
        )}
      </div>
      <Flex vertical className="template-detail">
        <div>
          <Typography.Title level={5} style={{ margin: '8px 0' }}>
            {t('template.templatePrompt')}
            <br />
            <Typography.Text type="secondary">
              {t('template.templatePromptDescription')}
            </Typography.Text>
          </Typography.Title>
          <div
            className="template-prompt-editor"
            style={{
              height: editorHeight,
              transition: 'height 0.3s ease-in-out',
              overflow: 'hidden',
              // maxHeight: '700px',
            }}
          >
            <div ref={editorRef}>
              <TiptapEditor
                key={isEditing ? 'editing' : 'readonly'}
                value={prompt as string}
                onChange={(html) => setPrompt(html)}
                showToolbar={isEditing}
                editable={isEditing}
              />
            </div>
          </div>
        </div>
        {/* <Typography.Title level={5} style={{ margin: '8px 0' }}>
          Sample Input <br />
          <Typography.Text type="secondary" style={{ display: 'none' }}>
            You may copy and edit this sample input to generate a document
            similar to the sample output below.
          </Typography.Text>
        </Typography.Title>
        <Typography.Paragraph
          copyable
          style={{
            backgroundColor: 'rgba(83,69,243,0.09)',
            border: '1px solid rgba(83,69,243,0.26)',
            padding: 16,
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            whiteSpace: 'pre-wrap',
            margin: '10px 0',
          }}
        >
          {template.sampleInputText}
        </Typography.Paragraph>
        <Typography.Title level={5} style={{ margin: '8px 0' }}>
          Sample Output
          <br />
          <Typography.Text type="secondary" style={{ display: 'none' }}>
            This sample output text is generated using the sample input and the
            template prompt above.
          </Typography.Text>
        </Typography.Title>
        <div
          className="sample-output-editor"
          style={{ margin: '10px 0 20px 0' }}
        >
          {template.type !== DOCTYPE.DEVELOPMENT_PLAN ? (
            <TiptapEditor
              value={template.sampleOutputText as string}
              showToolbar={false}
              editable={false}
            />
          ) : (
            <Tree
              className="draggable-tree"
              defaultExpandAll={true}
              treeData={treeData}
            />
          )}
        </div> */}
      </Flex>
    </>
  );
};
