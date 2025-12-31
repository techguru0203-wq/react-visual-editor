import { FC } from 'react';
import { Card, Flex, Tag, Typography } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import { DocTypeOptionsSelection } from '../../documents/types/documentTypes';
import { TemplateDocumentItemType } from '../types/templateDocumentTypes';

import './TemplateDocumentList.scss';

export interface TemplateDocumentProps {
  item: TemplateDocumentItemType;
  isInUse: boolean;
  onClick: () => void;
}

export const TemplateDocumentItem: FC<TemplateDocumentProps> = (props) => {
  const { item, onClick, isInUse } = props;
  const { t } = useLanguage();

  const handleClickItem = () => {
    onClick && onClick();
  };
  return (
    <Card
      hoverable
      onClick={handleClickItem}
      className={
        isInUse
          ? 'template-document-item template-document-item-active'
          : 'template-document-item'
      }
    >
      <Card.Meta
        title={
          <Flex vertical align="left">
            <Typography.Paragraph
              ellipsis
              style={{ fontSize: '14px', marginBottom: '0.5em' }}
            >
              {item.name}
            </Typography.Paragraph>
            <Flex
              align="center"
              justify="space-between"
              style={{ margin: '0px 0' }}
            >
              <Typography.Text
                type="secondary"
                style={{ fontSize: '12px' }}
                ellipsis
              >
                {t('template.by')} {item.organization?.name}
              </Typography.Text>
              <Tag style={{ fontSize: '12px', color: 'gray' }}>
                {
                  DocTypeOptionsSelection.find((it) => it.value === item.type)
                    ?.label
                }
              </Tag>
            </Flex>
          </Flex>
        }
        description={
          <Flex align="left" justify="space-between" vertical>
            <Typography.Paragraph
              ellipsis={{ rows: 4 }}
              style={{
                margin: '5px 0 5px',
                fontSize: '13px',
                textAlign: 'left',
                height: '80px',
              }}
            >
              {item.description}
            </Typography.Paragraph>

            <Flex justify="space-evenly" style={{ marginTop: 5 }}>
              {isInUse && <Tag color="#5345F3">{t('template.inUse')}</Tag>}
              <Tag className="template-access">
                {t('template.access').replace(
                  '{access}',
                  item.access.toLowerCase()
                )}
              </Tag>
            </Flex>
          </Flex>
        }
      />
    </Card>
  );
};
