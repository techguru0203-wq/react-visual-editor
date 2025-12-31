import { useState } from 'react';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { DOCTYPE } from '@prisma/client';
import { Button, Flex, Input, Select, Typography } from 'antd';
import Layout, { Content, Header } from 'antd/es/layout/layout';
import debounce from 'lodash/debounce';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import { DEFAULT_PAGE_LIMIT } from '../../../lib/constants';
import { DocTypeOptionsSelection } from '../../documents/types/documentTypes';
import { CreateNewTemplateDocumentsPath } from '../../nav/paths';
import { TemplateDocumentList } from '../../templateDocument/components/TemplateDocumentList';
import { TemplateDocumentItemType } from '../../templateDocument/types/templateDocumentTypes';
import useOrgTemplateDocumentsQuery from '../hooks/useOrgTemplateDocumentsQuery';

export default function UserTemplateDocuments() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [keyword, setKeyword] = useState('');

  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_LIMIT);

  const { isLoading, isRefetching, isError, error, data } =
    useOrgTemplateDocumentsQuery(keyword, type, page, limit);

  if (isError) {
    throw error;
  }

  let templateItems: ReadonlyArray<TemplateDocumentItemType> = [];
  if (data) {
    templateItems = data.list;
  }

  const onSearch = (e: any) => {
    console.log(e, e.target.value);
    setKeyword(e.target.value);
  };

  const debounceSearch = debounce(onSearch, 800);

  return (
    <Layout style={{ backgroundColor: '#fff' }} className="page-container">
      <Typography.Title level={4} className="main-heading">
{t('template.documentTemplates')}
      </Typography.Title>
      <Header
        style={{
          paddingInline: 0,
          height: 'inherit',
          lineHeight: 1.5,
          backgroundColor: '#fff',
        }}
      >
        <Flex
          justify="space-between"
          style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}
        >
          <Input
            addonBefore={
              <Select
                style={{ minWidth: 130 }}
                // defaultValue={type}
                value={type}
                options={DocTypeOptionsSelection.filter(
                  (item) =>
                    item.value !== 'CHAT' &&
                    item.value !== DOCTYPE.DEVELOPMENT_PLAN &&
                    item.value !== DOCTYPE.PROTOTYPE
                )}
                onChange={(value) => {
                  console.log(value);
                  setType(value);
                }}
              ></Select>
            }
            allowClear
            placeholder={t('template.searchPlaceholder')}
            onChange={debounceSearch}
            style={{ width: '60%', minWidth: 288 }}
            suffix={<SearchOutlined />}
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
      </Header>

      <Content
        style={{
          padding: '10px 0',
          minHeight: 465,
          backgroundColor: '#fff',
          paddingLeft: '8px',
        }}
      >
        <TemplateDocumentList
          isLoading={isLoading || isRefetching}
          xl={6}
          xxl={4}
          items={templateItems}
          pagination={{
            page,
            limit,
            total: data?.pagination.total || 0,
          }}
          onItemClick={(itemData) => {
            // setSelectedTemplate(itemData);
            navigate(itemData.id);
          }}
          onPaginationChange={(page, limit) => {
            setPage(page);
            setLimit(limit);
          }}
        />
      </Content>
    </Layout>
  );
}
