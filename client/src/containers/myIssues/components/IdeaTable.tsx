import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { ReactComponent as ChatIcon } from '../../../common/icons/chat-icon.svg';
import { ReactComponent as EmptyIcon } from '../../../common/icons/empty-icon.svg';
import { COLORS } from '../../../lib/constants';
import { ChatSessionOutput } from '../../chats/types/chatTypes';
import { IdeasPath } from '../../nav/paths';

export function IdeaTable({ ideas }: { ideas: ChatSessionOutput[] }) {
  const navigate = useNavigate();

  return ideas
    .sort((a, b) => {
      return dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix();
    })
    .slice(0, Math.min(6, ideas.length))
    .map((idea, index) => (
      <Flex className="doc-item" key={index}>
        <div>
          <ChatIcon style={{ fontSize: '20px', color: COLORS.PRIMARY }} />
        </div>
        <div
          className="link-button"
          style={{
            marginLeft: '6px',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
          onClick={() => {
            navigate(`/${IdeasPath}/${idea.id}`);
          }}
        >
          {idea.name} &nbsp;
        </div>
      </Flex>
    ));
}

export function EmptyIdea() {
  const { showAppModal } = useAppModal();
  return (
    <Flex
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        border: `solid 1px ${COLORS.LIGHT_GRAY}`,
        borderRadius: '15px',
        marginBottom: '10px',
      }}
    >
      <Flex
        vertical
        style={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '15px',
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
          <div style={{ marginTop: '10px' }}>No ideas available</div>
        </div>
        <Button
          id="add-project-btn"
          type="primary"
          icon={<PlusOutlined />}
          size={'middle'}
          onClick={() => showAppModal({ type: 'addChat' })}
        >
          New Idea
        </Button>
      </Flex>
    </Flex>
  );
}
