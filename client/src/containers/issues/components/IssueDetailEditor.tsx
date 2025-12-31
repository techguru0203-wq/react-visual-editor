import { useCallback } from 'react';
import { LeftOutlined } from '@ant-design/icons';
import { Button, Flex, Layout, Spin, theme } from 'antd';
import { Content } from 'antd/es/layout/layout';
import Sider from 'antd/es/layout/Sider';
import { useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../../../common/contexts/languageContext';
import { useProjectAccessQuery } from '../../../common/hooks/useProjectsQuery';
import { useComments } from '../hooks/useComments';
import { useIssue, useIssueChangeHistory } from '../hooks/useIssue';
import IssueDetailEditorContent from './IssueDetailEditorContent';
import { IssueDetailEditorSide } from './IssueDetailEditorSide';

import './IssueDetailEditor.scss';

export default function IssueDetailEditor() {
  const { shortName } = useParams();
  const { data: issue, isLoading, isError, error } = useIssue(shortName);
  const { data: access } = useProjectAccessQuery(issue?.projectId as string);
  const editable = access?.projectPermission === 'EDIT';
  const { t } = useLanguage();
  const {
    data: comments,
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    error: commentsError,
  } = useComments(shortName);
  const { data: issueChangeHistory } = useIssueChangeHistory(shortName);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const navigate = useNavigate();
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <Spin spinning={isLoading}>
      {issue && (
        <Layout
          className="issue-editor-layout"
          style={{ backgroundColor: colorBgContainer, gap: '24px' }}
        >
          <Content className="issue-detail-editor" style={{ padding: 0 }}>
            <div style={{ padding: '0 0px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: '8px',
                }}
              >
                <Button type="link" onClick={goBack} style={{ paddingLeft: 0 }}>
                  <Flex align="center">
                    <LeftOutlined />
                    <span>{t('issues.back')}</span>
                  </Flex>
                </Button>
              </div>
              <IssueDetailEditorContent
                issue={issue}
                comments={comments}
                issueChangeHistory={issueChangeHistory || undefined}
                editable={editable}
              />
            </div>
          </Content>
          <Sider
            className="issue-editor-form"
            width={'380px'}
            style={{
              background: colorBgContainer,
            }}
          >
            <IssueDetailEditorSide issue={issue} editable={editable} />
          </Sider>
        </Layout>
      )}
    </Spin>
  );
}
