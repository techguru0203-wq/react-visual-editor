import { FC, useEffect, useState } from 'react';
import { LeftOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { DOCTYPE, TemplateDocument } from '@prisma/client';
import {
  Button,
  Flex,
  GetProp,
  Input,
  Layout,
  Menu,
  MenuProps,
  Modal,
  Typography,
} from 'antd';
import { Content } from 'antd/es/layout/layout';
import Sider from 'antd/es/layout/Sider';
import debounce from 'lodash/debounce';
import { useNavigate } from 'react-router';

import '../../../common/components/AppModal.scss';

import { useLanguage } from '../../../common/contexts/languageContext';
import { DEFAULT_PAGE_LIMIT } from '../../../lib/constants';
import { DocTypeOptionsSelection } from '../../documents/types/documentTypes';
import { CreateNewTemplateDocumentsPath } from '../../nav/paths';
import useTemplateDocumentsQuery from '../hooks/useTemplateDocumentsQuery';
import { TemplateDocumentItemType } from '../types/templateDocumentTypes';
import { TemplateDetail } from './TemplateDetail';
import { TemplateDocumentList } from './TemplateDocumentList';

export interface TemplateModalProps {
  open: boolean;
  selectedTemplateId?: string;
  onClose: () => void;
  onUseTemplate: (template: TemplateDocument) => void;
}

const contentStyle: React.CSSProperties = {
  paddingBottom: '10px',
  paddingTop: '2px',
  minHeight: 465,
  backgroundColor: '#fff',
};

const layoutStyle = {
  borderRadius: 8,
  overflow: 'hidden',
  width: '100%',
  backgroundColor: '#fff',
};

export const TemplateCenterModal: FC<TemplateModalProps> = (props) => {
  const { open, onClose, onUseTemplate, selectedTemplateId } = props;
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateDocumentItemType | null>(null);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_LIMIT);
  const { isLoading, isError, data } = useTemplateDocumentsQuery(
    keyword,
    type,
    page,
    limit
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setType('');
      setPage(1);
      setSelectedTemplate(null);
    }
  }, [open]);
  let templateItems: ReadonlyArray<TemplateDocumentItemType> = [];
  if (data) {
    templateItems = data.list.filter(
      (item) => ![DOCTYPE.UI_DESIGN as string].includes(item.type as string)
    );
  }

  const onSearch = (e: any) => {
    console.log(e, e.target.value);
    setKeyword(e.target.value);
  };

  const debounceSearch = debounce(onSearch, 800);

  type MenuItem = GetProp<MenuProps, 'items'>[number];
  const items: MenuItem[] = DocTypeOptionsSelection.filter(
    (item) =>
      ![
        DOCTYPE.UI_DESIGN as string,
        DOCTYPE.DEVELOPMENT_PLAN as string,
        DOCTYPE.PROTOTYPE as string,
      ].includes(item.value as string)
  ).map((item) => {
    return {
      key: item.value,
      label: item.label,
    };
  });

  const handleUseTemplate = function (data: TemplateDocumentItemType) {
    onUseTemplate(data);
    onClose();
  };
  const handleTemplateUpdated = (updatedTemplate: TemplateDocumentItemType) => {
    setSelectedTemplate(updatedTemplate); // Update the selected template with the updated data
  };

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 767);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, [setIsMobile]);

  return (
    <Modal
      footer={null}
      centered
      maskClosable
      open={open}
      onCancel={onClose}
      closable={true}
      width={'90%'}
      styles={{
        body: { maxWidth: '1440px', height: '100vh', overflowY: 'auto' },
      }}
      className="custom-modal"
      title={
        <Flex align="center" justify="space-between" style={{ width: '90%' }}>
          <Typography.Title style={{ margin: 0, flex: 1 }} level={4}>
            {t('template.templateCenter')}
          </Typography.Title>
        </Flex>
      }
    >
      <Layout style={layoutStyle}>
        <div>
          {isMobile ? (
            <Menu
              defaultSelectedKeys={['']}
              selectedKeys={[type]}
              mode="horizontal"
              theme="light"
              items={items}
              onClick={(e) => {
                setType(e.key);
                setSelectedTemplate(null);
              }}
              style={{ marginBottom: '16px' }}
            />
          ) : (
            <Sider
              width="200"
              style={{ backgroundColor: '#fff', paddingRight: 16 }}
            >
              <Menu
                style={{ paddingRight: 16 }}
                defaultSelectedKeys={['']}
                selectedKeys={[type]}
                mode="vertical"
                theme="light"
                items={items}
                onClick={(e) => {
                  setType(e.key);
                  setSelectedTemplate(null);
                }}
              />
            </Sider>
          )}
        </div>
        <Layout>
          {selectedTemplate && (
            <Flex justify="left" style={{ background: '#fff' }}>
              <Button
                type="link"
                icon={<LeftOutlined />}
                onClick={(e) => setSelectedTemplate(null)}
                style={{
                  padding: '5px 0',
                  background: '#fff',
                  textAlign: 'left',
                }}
              >
                {t('template.back')}
              </Button>
            </Flex>
          )}
          <Content style={contentStyle}>
            {selectedTemplate ? (
              <TemplateDetail
                templateData={selectedTemplate}
                onUse={handleUseTemplate}
                onTemplateUpdated={handleTemplateUpdated}
              />
            ) : (
              <>
                <Flex
                  justify="space-between"
                  style={{
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <Input
                    placeholder={t('template.searchPlaceholder')}
                    onChange={debounceSearch}
                    style={{
                      maxWidth: 500,
                      minWidth: 255,
                      flex: 2,
                    }}
                    prefix={<SearchOutlined />}
                    allowClear
                  />
                  <Button
                    type="primary"
                    style={{ marginLeft: 'auto' }}
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      navigate('/' + CreateNewTemplateDocumentsPath);
                    }}
                  >
                    {t('template.newTemplate')}
                  </Button>
                </Flex>
                <div style={{ paddingLeft: '8px' }}>
                  <TemplateDocumentList
                    selectedTemplateId={selectedTemplateId}
                    isLoading={isLoading}
                    items={[...templateItems].sort((a, b) => {
                      if (a.id === selectedTemplateId) {
                        return -1;
                      }
                      return 0;
                    })}
                    pagination={{
                      page,
                      limit,
                      total: data?.pagination.total || 0,
                    }}
                    onItemClick={(itemData) => {
                      setSelectedTemplate(itemData);
                    }}
                    onPaginationChange={(page, limit) => {
                      setPage(page);
                      setLimit(limit);
                    }}
                  />
                </div>
              </>
            )}
          </Content>
        </Layout>
      </Layout>
    </Modal>
  );
};
