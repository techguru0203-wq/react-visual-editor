import { useEffect, useState } from 'react';
import { Access, ChatSession } from '@prisma/client';
import { Button, Flex, Input } from 'antd';
import { useNavigate } from 'react-router-dom';

import idea from '../../../common/icons/idea.png';
import trackEvent from '../../../trackingClient';
import { useChatMutation } from '../../chats/hooks/useChatMutation';
import { IdeasPath } from '../../nav/paths';

let selfClicked = false;
export function BrainstormCard() {
  const [isSaving, setIsSaving] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  const navigate = useNavigate();
  const { upsertChatSessionMutation } = useChatMutation({
    onSuccess: (chatSession: ChatSession) => {
      setIsSaving(false);
      navigate(`/${IdeasPath}/${chatSession.id}`);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  const onSave = () => {
    if (!inputValue) {
      return;
    }
    upsertChatSessionMutation.mutate({ name: inputValue, access: Access.SELF });
    setIsSaving(true);
    trackEvent('chatClientClicked', {
      inputValue,
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
        <Flex className="home-card-title">Refine an idea</Flex>
      </Flex>
      {isEditMode ? (
        <Flex vertical className="home-card-input">
          <Input
            className="form-input"
            placeholder="Enter a name for the idea"
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
              Cancel
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
          Get instant feedback when refining your product ideas or requirements.
        </div>
      )}
    </Flex>
  );
}
