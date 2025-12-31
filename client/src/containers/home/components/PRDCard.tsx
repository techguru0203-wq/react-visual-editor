import { useEffect, useState } from 'react';
import { Access, DOCTYPE } from '@prisma/client';
import { Button, Flex, Input } from 'antd';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import idea from '../../../common/icons/idea.png';
import trackEvent from '../../../trackingClient';
import { useDocumentMutation } from '../../documents/hooks/useDocumentMutation';
import { LegacyDocumentOutput } from '../../project/types/projectType';

let selfClicked = false;
export function PRDCard() {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [inputValue, setInputValue] = useState('');
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
    if (!inputValue) {
      return;
    }
    createDocumentMutation.mutate({
      name: inputValue,
      type: DOCTYPE.PRD,
      access: Access.SELF,
    });
    setIsSaving(true);
    trackEvent('PRDClientClicked', {
      name: inputValue,
      type: DOCTYPE.PRD,
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
      className="home-card"
      onClick={() => {
        selfClicked = true;
        if (!isEditMode) {
          setIsEditMode(true);
        }
      }}
    >
      <Flex className="home-card-top">
        <img alt="idea" src={idea} style={{ height: 50 }} />
        <Flex className="home-card-title">{t('home.craftRequirement')}</Flex>
      </Flex>
      {isEditMode ? (
        <Flex vertical className="home-card-input">
          <Input
            className="form-input"
            placeholder={t('home.enterRequirementName')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Flex style={{ marginTop: '15px', justifyContent: 'flex-end' }}>
            <Button
              className="cancel-button"
              type="default"
              onClick={() => setIsEditMode(false)}
              size="small"
            >
              {t('home.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSaving}
              onClick={onSave}
              size="small"
            >
              Go
            </Button>
          </Flex>
        </Flex>
      ) : (
        <div className="home-card-description">
          {t('home.craftRequirementDescription')}
        </div>
      )}
    </Flex>
  );
}
