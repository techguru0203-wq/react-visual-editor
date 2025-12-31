import { useEffect, useState } from 'react';
import { Access, DOCTYPE } from '@prisma/client';
import { Button, Flex, Input, Select } from 'antd';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as CreateDocument } from '../../../common/icons/create-document.svg';
import trackEvent from '../../../trackingClient';
import { useDocumentMutation } from '../../documents/hooks/useDocumentMutation';
import { DocTypeOptionsSelection } from '../../documents/types/documentTypes';
import { LegacyDocumentOutput } from '../../project/types/projectType';

let selfClicked = false;
export function DocumentCard() {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [docType, setDocValue] = useState('');
  const [docName, setDocName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const navigate = useNavigate();

  const { createDocumentMutation } = useDocumentMutation({
    onSuccess: (document: LegacyDocumentOutput) => {
      setIsSaving(false);
      navigate(`/docs/${document.id}`, {
        state: { autoCollapseSidepanel: true },
      });
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  const onSave = () => {
    if (!docName || !docType) {
      return;
    }
    createDocumentMutation.mutate({
      name: docName,
      type: docType as DOCTYPE,
      access: Access.SELF,
    });
    setIsSaving(true);
    trackEvent('documentClientClicked', {
      type: docType as DOCTYPE,
    });
  };

  useEffect(() => {
    const clickBody = () => {
      if (!selfClicked) {
        setIsEditMode(false);
      }
      selfClicked = false;
    };

    window.document.body.addEventListener('click', clickBody);
    return () => {
      window.document.body.removeEventListener('click', clickBody);
    };
  }, []);

  return (
    <Flex
      className="home-card small-card"
      onClick={() => {
        selfClicked = true;
        if (!isEditMode) {
          setIsEditMode(true);
        }
      }}
    >
      <CreateDocument />
      <Flex className="home-card-title">{t('home.createDocument')}</Flex>
      {isEditMode ? (
        <Flex vertical style={{ height: '36px' }}>
          <Flex>
            <Input
              className="doc-name"
              placeholder={t('home.newDocumentName')}
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onKeyUp={(event) => {
                if (event.key === 'Enter') {
                  onSave();
                }
              }}
            />
            <Select
              onChange={(e) => setDocValue(e)}
              placeholder={t('home.documentType')}
              style={{ width: '160px' }}
              className="form-input"
              allowClear
              options={DocTypeOptionsSelection.slice(1).filter(
                (item) =>
                  item.value !== 'CHAT' &&
                  item.value !== DOCTYPE.DEVELOPMENT_PLAN
              )}
            />
          </Flex>
          <Flex style={{ marginTop: '15px', justifyContent: 'flex-end' }}>
            <Button
              className="cancel-button"
              type="default"
              onClick={() => setIsEditMode(false)}
            >
              {t('home.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSaving}
              onClick={onSave}
            >
              Go
            </Button>
          </Flex>
        </Flex>
      ) : (
        <div className="home-card-description">
          {t('home.generateDocsDescription')}
        </div>
      )}
    </Flex>
  );
}
