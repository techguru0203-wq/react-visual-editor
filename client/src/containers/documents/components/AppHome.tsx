import React, { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { DOCTYPE } from '@prisma/client';
import { Button, Flex, Spin } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { RollupSection } from '../../../common/components/RollupSection';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as EmptyIcon } from '../../../common/icons/empty-icon.svg';
import { COLORS } from '../../../lib/constants';
import { useUserDocuments } from '../hooks/useUserDocuments';
import { DocumentOutput } from '../types/documentTypes';
import DocumentList from './DocumentList';

const AppHome: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { showAppModal } = useAppModal();
  const { data: documents, isLoading } = useUserDocuments(user.id);
  const [docs, setDocs] = useState<DocumentOutput[]>([]);

  useEffect(() => {
    setDocs(documents?.filter((d) => d.type === DOCTYPE.PROTOTYPE) || []);
  }, [documents, setDocs]);

  return (
    <Spin spinning={isLoading}>
      <Flex vertical>
        <RollupSection title={t('document.currentApps')} actions={[]}>
          {documents?.length ? (
            <DocumentList documents={docs || []} />
          ) : (
            <Flex
              vertical
              style={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '15px',
                height: '100%',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  color: COLORS.GRAY,
                  marginBottom: '20px',
                }}
              >
                <EmptyIcon />
                <div style={{ marginTop: '10px' }}>
                  {t('document.noAppsAvailable')}
                </div>
              </div>
              <Button
                id="add-project-btn"
                type="primary"
                icon={<PlusOutlined />}
                size={'middle'}
                onClick={() =>
                  showAppModal({
                    type: 'addDocument',
                    docType: DOCTYPE.PROTOTYPE,
                  })
                }
              >
                {t('document.newApp')}
              </Button>
            </Flex>
          )}
          <></>
        </RollupSection>
      </Flex>
    </Spin>
  );
};

export default AppHome;
