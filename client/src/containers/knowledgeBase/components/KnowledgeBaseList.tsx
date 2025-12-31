import { useState } from 'react';
import {
  DeleteOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Flex,
  Input,
  message,
  Modal,
  Row,
  Spin,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import { RollupSection } from '../../../common/components/RollupSection';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { KnowledgeBasePath } from '../../nav/paths';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import {
  deleteKnowledgeBaseApi,
  getKnowledgeBaseListApi,
  KnowledgeBase,
} from '../api/knowledgeBaseApi';
import { AssignKnowledgeBaseModal } from './AssignKnowledgeBaseModal';
import { CreateKnowledgeBaseModal } from './CreateKnowledgeBaseModal';

import './KnowledgeBaseList.scss';

const { Text } = Typography;

export function KnowledgeBaseList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, organization } = useCurrentUser();
  const { data: organizationHierarchy } = useOrganizationHierarchy();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigningKb, setAssigningKb] = useState<KnowledgeBase | null>(null);
  const [deletingKb, setDeletingKb] = useState<KnowledgeBase | null>(null);

  const {
    data: knowledgeBases = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['knowledgeBases', organization?.id],
    queryFn: getKnowledgeBaseListApi,
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch when component remounts
  });

  const filteredKnowledgeBases = knowledgeBases.filter((kb) =>
    kb.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCreateSuccess = () => {
    message.success(t('knowledgeBase.createSuccess'));
    refetch();
    setIsCreateModalOpen(false);
  };

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeBaseApi,
    onSuccess: () => {
      message.success(t('knowledgeBase.deleteSuccess'));
      refetch();
      setDeletingKb(null);
    },
    onError: (error: Error) => {
      message.error(error.message || t('knowledgeBase.deleteError'));
    },
  });

  const handleDelete = (kb: KnowledgeBase) => {
    Modal.confirm({
      title: t('knowledgeBase.deleteKnowledgeBase'),
      content: t('knowledgeBase.deleteWarning'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: () => {
        deleteMutation.mutate(kb.id);
      },
    });
  };

  const handleMenuClick = (
    e: { key: string; domEvent?: React.MouseEvent | React.KeyboardEvent },
    kb: KnowledgeBase
  ) => {
    e.domEvent?.stopPropagation();
    if (e.key === 'delete') {
      handleDelete(kb);
    } else if (e.key === 'assign') {
      setAssigningKb(kb);
    }
  };

  const renderContent = () => {
    const elements = [];

    // Always show header section (similar to OrganizationHome)
    elements.push(
      <div key="header" className="header-section" style={{ width: '100%' }}>
        <Flex
          justify="space-between"
          style={{
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <Input
            placeholder={t('knowledgeBase.searchPlaceholder')}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              maxWidth: 500,
              minWidth: 255,
              flex: 2,
            }}
            prefix={<SearchOutlined />}
            allowClear
            value={searchText}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Knowledge base
          </Button>
        </Flex>
      </div>
    );

    elements.push(
      <div key="content" style={{ width: '100%' }}>
        {error ? (
          <Empty
            description={
              <div>
                <Text type="danger">{t('knowledgeBase.loadError')}</Text>
                <div style={{ marginTop: '8px' }}>
                  <Button onClick={() => refetch()}>
                    {t('knowledgeBase.retry')}
                  </Button>
                </div>
              </div>
            }
          />
        ) : isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredKnowledgeBases.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchText
                ? t('knowledgeBase.noSearchResults')
                : t('knowledgeBase.noKnowledgeBases')
            }
          >
            {!searchText && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                {t('knowledgeBase.createFirst')}
              </Button>
            )}
          </Empty>
        ) : (
          <Row
            gutter={[16, 16]}
            style={{
              width: '100%',
              minHeight: 300,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {filteredKnowledgeBases.map((kb) => {
              const menuItems: MenuProps['items'] = [
                {
                  key: 'assign',
                  label:
                    t('knowledgeBase.assignToProject') || 'Assign to Project',
                  icon: <LinkOutlined />,
                },
                {
                  type: 'divider',
                },
                {
                  key: 'delete',
                  label: t('common.delete'),
                  icon: <DeleteOutlined />,
                  danger: true,
                },
              ];

              return (
                <Col
                  className="gutter-row"
                  xs={24}
                  sm={12}
                  md={8}
                  lg={8}
                  xl={8}
                  xxl={8}
                  key={kb.id}
                  style={{ minWidth: '300px' }}
                >
                  <Card
                    hoverable
                    onClick={() => navigate(`/${KnowledgeBasePath}/${kb.id}`)}
                    className="knowledge-base-card"
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <Card.Meta
                      title={
                        <Flex vertical align="left">
                          <Typography.Paragraph
                            ellipsis
                            style={{ fontSize: '14px', marginBottom: '0.5em' }}
                          >
                            {kb.name}
                          </Typography.Paragraph>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px' }}
                            ellipsis
                          >
                            {t('knowledgeBase.by')} {kb.creator.username}
                          </Typography.Text>
                        </Flex>
                      }
                      description={
                        <Flex align="left" justify="space-between" vertical>
                          {kb.description && (
                            <Typography.Paragraph
                              ellipsis={{ rows: 2 }}
                              style={{
                                margin: '5px 0 5px',
                                fontSize: '13px',
                                textAlign: 'left',
                                height: '40px',
                              }}
                            >
                              {kb.description}
                            </Typography.Paragraph>
                          )}

                          <div
                            style={{
                              fontSize: '12px',
                              color: 'gray',
                              marginTop: '5px',
                              marginBottom: '5px',
                            }}
                          >
                            {t('knowledgeBase.files')}
                            {kb._count?.files || 0}
                          </div>

                          <Flex
                            justify="space-between"
                            align="center"
                            style={{ marginTop: 5 }}
                          >
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: '12px' }}
                            >
                              {new Date(kb.createdAt).toLocaleDateString()}
                            </Typography.Text>
                            <Dropdown
                              menu={{
                                items: menuItems,
                                onClick: (e) => handleMenuClick(e, kb),
                              }}
                              trigger={['click']}
                              placement="bottomRight"
                            >
                              <Button
                                type="text"
                                icon={
                                  <MoreOutlined
                                    style={{ transform: 'rotate(90deg)' }}
                                  />
                                }
                                className="knowledge-base-card-menu"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                style={{
                                  padding: '4px 8px',
                                  height: 'auto',
                                }}
                              />
                            </Dropdown>
                          </Flex>
                        </Flex>
                      }
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    );

    return elements;
  };

  return (
    <Flex className="page-container knowledge-base-home" vertical>
      <RollupSection title={t('knowledgeBase.title')} actions={[]}>
        {renderContent()}
      </RollupSection>

      <CreateKnowledgeBaseModal
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {assigningKb && (
        <AssignKnowledgeBaseModal
          knowledgeBase={assigningKb}
          open={!!assigningKb}
          onCancel={() => setAssigningKb(null)}
          onSuccess={() => {
            refetch();
            setAssigningKb(null);
          }}
        />
      )}
    </Flex>
  );
}
