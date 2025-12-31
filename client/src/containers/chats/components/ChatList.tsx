import { useEffect, useState } from 'react';
import { Flex, Space, Table, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import _ from 'lodash';
import { useNavigate } from 'react-router';

import { UserAvatar } from '../../../common/components/UserAvatar';
import { ReactComponent as ChatIcon } from '../../../common/icons/chat-icon.svg';
import { COLORS } from '../../../lib/constants';
import { ChatDropdownOperMenu } from '../../layout/components/ChatDropdownOperMenu';
import { IdeasPath } from '../../nav/paths';
import { ChatSessionOutput } from '../types/chatTypes';

type DocumentListProps = Readonly<{
  chatSessions: ChatSessionOutput[];
}>;

export default function ChatList({ chatSessions }: DocumentListProps) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 639);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  let cols = getChatListTableColumns(navigate, isMobile);
  let data = getChatListData(chatSessions);

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Table className="chat-list" columns={cols} dataSource={data} />
    </Space>
  );
}

function getChatListTableColumns(
  navigate: (id: string) => void,
  isMobile: boolean
) {
  const baseColumns = [
    {
      title: 'Name',
      key: 'name',
      flex: 1,
      ellipsis: {
        showTitle: false,
      },
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (record: any) => {
        return (
          <Flex
            style={{ alignItems: 'center', cursor: 'pointer', width: '100%' }}
            onClick={() => {
              navigate(`/${IdeasPath}/${record.id}`);
            }}
          >
            <div>
              <ChatIcon style={{ fontSize: '20px', color: COLORS.PRIMARY }} />
            </div>
            <Tooltip placement="topLeft" title={record.name}>
              <div
                className="link-button"
                style={{
                  marginLeft: '6px',
                  marginTop: '-6px',
                  width: 'calc(100% - 28px)',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onClick={() => navigate(`/${IdeasPath}/${record.id}`)}
              >
                {record.name}
              </div>
            </Tooltip>
          </Flex>
        );
      },
    },
    {
      title: 'Owner',
      flex: 1,
      key: 'owner',
      ellipsis: true,
      sorter: (a: any, b: any) =>
        a.creator?.username.localeCompare(b.creator?.username),
      render: (rec: any) => {
        return (
          <Space style={{ width: '100%' }} className="owner-cell">
            <UserAvatar user={rec.user} />
            <Typography.Text
              style={{
                width: '100%',
                display: 'block',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {rec.user?.username}
            </Typography.Text>
          </Space>
        );
      },
    },
  ];

  const additionalDesktopColumns = [
    {
      title: 'Access',
      key: 'access',
      flex: 1,
      ellipsis: true,
      sorter: (a: any, b: any) => a.access.localeCompare(b.access),
      render: (rec: any) => {
        return <Typography.Text>{_.capitalize(rec.access)}</Typography.Text>;
      },
    },
    {
      title: 'Created At',
      key: 'createdAt',
      flex: 1,
      ellipsis: true,
      sorter: (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      render: (rec: any) => {
        return (
          <Typography.Text>
            {dayjs(rec.createdAt).format('MM/DD/YYYY')}
          </Typography.Text>
        );
      },
    },
  ];

  const actionColumn = {
    title: isMobile ? '' : 'Action',
    key: 'action',
    width: isMobile ? '48px' : '80px',
    render: (rec: any) => {
      return <ChatDropdownOperMenu chat={rec} />;
    },
  };

  return isMobile
    ? [...baseColumns, actionColumn]
    : [...baseColumns, ...additionalDesktopColumns, actionColumn];
}

function getChatListData(chatSessions: ChatSessionOutput[]) {
  let data: Array<any> = chatSessions.map((doc, index) => ({
    ...doc,
    key: index,
  }));
  data.sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix());
  return data;
}
