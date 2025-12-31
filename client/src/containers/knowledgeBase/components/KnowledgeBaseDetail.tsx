import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Tabs,
  Typography,
  Spin,
  Space,
  Modal,
  message,
  Breadcrumb,
} from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { KnowledgeBasePath } from '../../nav/paths';
import {
  getKnowledgeBaseByIdApi,
  deleteKnowledgeBaseApi,
} from '../api/knowledgeBaseApi';
import { FileManager } from './FileManager';
import { KnowledgeChat } from './KnowledgeChat';
import { KnowledgeSettings } from './KnowledgeSettings';

const { Title } = Typography;

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  files: any[];
  creator: {
    id: string;
    username: string;
    email: string;
  };
  projectLinks: any[];
}

export function KnowledgeBaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('chat');

  const {
    data: knowledgeBase,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['knowledgeBase', id],
    queryFn: () => getKnowledgeBaseByIdApi(id!),
    enabled: !!id,
  });

  const handleDelete = () => {
    Modal.confirm({
      title: t('knowledgeBase.confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: t('knowledgeBase.confirmDeleteMessage'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await deleteKnowledgeBaseApi(id!);

          // Update local cache by removing the deleted item
          const cacheKey = ['knowledgeBases', organization?.id];
          queryClient.setQueryData(cacheKey, (oldData: any[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.filter((kb) => kb.id !== id);
          });

          message.success(t('knowledgeBase.deleteSuccess'));
          navigate(`/${KnowledgeBasePath}`);
        } catch (error: any) {
          message.error(error.message || t('knowledgeBase.deleteError'));
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Typography.Text type="secondary">
          {t('knowledgeBase.notFound')}
        </Typography.Text>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined /> {t('knowledgeBase.chat')}
        </span>
      ),
      children: (
        <KnowledgeChat
          knowledgeBaseId={id!}
          knowledgeBaseName={knowledgeBase.name}
        />
      ),
    },
    // {
    //   key: 'test',
    //   label: (
    //     <span>
    //       <SearchOutlined /> {t('knowledgeBase.test')}
    //     </span>
    //   ),
    //   children: <KnowledgeTest knowledgeBaseId={id!} />,
    // },
    {
      key: 'settings',
      label: (
        <span>
          <SettingOutlined /> {t('knowledgeBase.settings')}
        </span>
      ),
      children: (
        <KnowledgeSettings
          knowledgeBase={knowledgeBase}
          onUpdate={refetch}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  return (
    <div
      style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Breadcrumb
          items={[
            {
              title: (
                <a onClick={() => navigate(`/${KnowledgeBasePath}`)}>
                  {t('knowledgeBase.title')}
                </a>
              ),
            },
            {
              title: knowledgeBase.name,
            },
          ]}
        />

        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Left Column - File List */}
          <div
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              maxWidth: 'calc(100% - 12px - clamp(360px, 35vw, 460px))',
            }}
          >
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#fff',
                overflowX: 'auto',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <Title level={4} style={{ marginTop: 0, marginBottom: '4px' }}>
                  {knowledgeBase.name}
                </Title>
                {knowledgeBase.description && (
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: '14px' }}
                  >
                    {knowledgeBase.description}
                  </Typography.Text>
                )}
              </div>
              <FileManager knowledgeBaseId={id!} onUpdate={refetch} />
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div
            style={{
              flex: '0 0 clamp(360px, 35vw, 460px)',
              minWidth: 'clamp(360px, 35vw, 460px)',
            }}
          >
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#fff',
              }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
              />
            </div>
          </div>
        </div>
      </Space>
    </div>
  );
}
