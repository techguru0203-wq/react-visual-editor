import { FC } from 'react';
import { Col, Pagination, Row, Spin } from 'antd';

import { PaginationInfo } from '../../../../../shared/types';
import { TemplateDocumentItemType } from '../types/templateDocumentTypes';
import { TemplateDocumentItem } from './TemplateDocumentItem';

export interface TemplateDocumentListProps {
  isLoading?: Boolean;
  items: ReadonlyArray<TemplateDocumentItemType>;
  pagination: PaginationInfo;
  xl?: number;
  xxl?: number;
  selectedTemplateId?: string;
  onPaginationChange?: (page: number, limit: number) => void;
  onItemClick?: (itemData: TemplateDocumentItemType) => void;
}

export const TemplateDocumentList: FC<TemplateDocumentListProps> = (props) => {
  const {
    isLoading = false,
    items,
    pagination,
    selectedTemplateId,
    onPaginationChange,
    onItemClick,
  } = props;
  const handleClickItem = (itemData: TemplateDocumentItemType) => {
    onItemClick && onItemClick(itemData);
  };

  return (
    <Spin spinning={isLoading ? true : false}>
      <Row
        gutter={[16, 16]}
        style={{
          width: '100%',
          minHeight: 300,
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {items &&
          items.map((item, index) => {
            return (
              <Col
                className="gutter-row"
                xs={24}
                sm={12}
                md={8}
                lg={8}
                xl={8}
                xxl={8}
                key={index}
                style={{ minWidth: '300px' }}
              >
                <TemplateDocumentItem
                  item={item}
                  onClick={() => {
                    handleClickItem(item);
                  }}
                  isInUse={selectedTemplateId === item.id}
                />
              </Col>
            );
          })}
      </Row>
      <Pagination
        align="end"
        style={{ textAlign: 'center', margin: 16 }}
        current={pagination.page}
        pageSize={pagination.limit}
        total={pagination.total}
        onChange={onPaginationChange}
      />
    </Spin>
  );
};
