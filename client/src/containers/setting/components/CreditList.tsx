import { useEffect, useState } from 'react';
import { DOCTYPE } from '@prisma/client';
import { Spin, Table, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import _ from 'lodash';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import { DocumentTypeNameMapping } from '../../documents/types/documentTypes';
import {
  DevPlansPath,
  DocumentsPath,
  IdeasPath,
  TemplateDocumentPath,
} from '../../nav/paths';
import { useCredits } from '../hooks/useCredits';

export default function CreditList() {
  const { t } = useLanguage();
  console.log('in containers.setting.components.CreditList');
  const navigate = useNavigate();
  const { data, isLoading } = useCredits();
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop'
  );

  const credits = data
    ?.map((it) => {
      return { ...it, key: it.id };
    })
    .sort((a, b) => {
      return dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix();
    });

  let cols = getCreditListTableColumns(navigate, t);

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 575) {
        setScreenSize('mobile');
      } else if (width <= 1023) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    window.addEventListener('resize', updateScreenSize);
    updateScreenSize();
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  if (screenSize === 'tablet') {
    cols = cols.filter((col) =>
      ['action', 'amount', 'status', 'docId'].includes(col.key)
    );
  } else if (screenSize === 'mobile') {
    cols = cols.filter((col) => ['action', 'docId'].includes(col.key));
  }

  return (
    <Spin spinning={isLoading}>
      <Table className="credit-list" columns={cols} dataSource={credits} />
    </Spin>
  );
}

function getCreditListTableColumns(
  navigate: (id: string) => void,
  t: (key: string) => string
) {
  const creditColumns = [
    {
      title: t('creditList.actionName'),
      key: 'action',
      flex: 1,
      ellipsis: {
        showTitle: false,
      },
      render: (record: any) => {
        return (
          <Tooltip
            placement="topLeft"
            title={_.capitalize(record.action).replace('_', ' ')}
          >
            <Typography.Text>
              {_.capitalize(record.action).replace('_', ' ')}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('creditList.amount'),
      key: 'amount',
      flex: 1,
      ellipsis: true,
      render: (rec: any) => {
        return <Typography.Text>{rec.amount}</Typography.Text>;
      },
    },
    {
      title: t('creditList.status'),
      key: 'status',
      flex: 1,
      ellipsis: true,
      render: (rec: any) => {
        return <Typography.Text>{rec.status}</Typography.Text>;
      },
    },
    {
      title: t('creditList.document'),
      key: 'docId',
      ellipsis: true,
      render: (rec: any) => {
        // If appLink exists, show it instead of document info
        if (rec.meta?.appLink) {
          return (
            <div style={{ width: '100%', gap: '4px' }}>
              <Typography.Text
                style={{
                  color: '#5345f3',
                  textAlign: 'left',
                  maxWidth: '100%',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  display: 'block',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  window.open(rec.meta.appLink, '_blank');
                }}
              >
                {rec.meta.appLink}
              </Typography.Text>
              <div
                style={{
                  fontSize: '12px',
                  background: '#28a745',
                  color: 'white',
                  height: '18px',
                  borderRadius: '8px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '18px',
                  marginTop: '2px',
                  padding: '0 4px',
                  width: 'fit-content',
                }}
                className="app-link-badge"
              >
                API Usage
              </div>
            </div>
          );
        }

        // Original document rendering logic
        return rec.meta?.docId || rec.meta?.templateDocId ? (
          <div style={{ width: '100%', gap: '4px' }}>
            <Typography.Text
              style={{
                color: '#5345f3',
                textAlign: 'left',
                maxWidth: '100%',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                display: 'block',
                cursor: 'pointer',
              }}
              onClick={() => {
                let docType = rec.meta?.docType;
                let path =
                  docType === DOCTYPE.DEVELOPMENT_PLAN
                    ? DevPlansPath
                    : docType === 'CHAT'
                      ? IdeasPath
                      : rec.meta?.docId
                        ? DocumentsPath
                        : TemplateDocumentPath;
                navigate(
                  `/${path}/${rec.meta?.docId || rec.meta?.templateDocId}`
                );
              }}
            >
              {rec.meta?.docName ||
                (rec.meta?.docType
                  ? DocumentTypeNameMapping(t)[rec.meta.docType]?.name
                  : 'Unknown')}
            </Typography.Text>
            <div
              style={{
                fontSize: '12px',
                background: '#a4a4a4',
                color: 'white',
                height: '18px',
                borderRadius: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: '18px',
                marginTop: '2px',
                padding: '0 4px',
                width: 'fit-content',
              }}
              className="document-badge"
            >
              {rec.amount}
            </div>
          </div>
        ) : (
          <Typography.Text type="secondary" style={{ padding: '4px 15px' }}>
            N.A.
          </Typography.Text>
        );
      },
    },
    {
      title: t('creditList.user'),
      key: 'user',
      flex: 1,
      ellipsis: true,
      sorter: (a: any, b: any) => a.meta?.email?.length - b.meta?.email?.length,
      render: (rec: any) => {
        return <Typography.Text>{rec.meta?.email || ''}</Typography.Text>;
      },
    },
    {
      title: t('creditList.createdAt'),
      key: 'createdAt',
      flex: 1,
      ellipsis: true,
      sorter: (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      render: (rec: any) => {
        return (
          <Typography.Text>
            {dayjs(rec.createdAt).format('MM/DD/YYYY h:mm A')}
          </Typography.Text>
        );
      },
    },
  ];

  return creditColumns;
}
