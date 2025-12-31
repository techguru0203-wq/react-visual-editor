import { useEffect, useState } from 'react';
import { EllipsisOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Typography } from 'antd';

const { Text } = Typography;

export interface ActionGroupItem {
  label: string;
  key: string;
  render?: () => JSX.Element;
  handler?: () => void;
}

interface ComponentProps {
  items: ReadonlyArray<ActionGroupItem>;
}

export default function ActionGroup({ items }: ComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  function onClick(evt: any) {
    console.log('handle modal show event:', evt);
    console.log('click ', evt.target);
  }

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 575);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const menuItems = items.map((item) => ({
    key: item.key,
    style: { padding: '0' },
    label: item.render ? (
      <div>{item.render()}</div>
    ) : (
      <Text onClick={item.handler || onClick}>{item.label}</Text>
    ),
  }));

  return (
    <Space className="action-group">
      {isMobile ? (
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button
            type="link"
            style={{
              padding: 0,
              color: 'black',
              height: 24,
              width: 24,
              borderRadius: '100%',
              background: '#e4e4e4',
            }}
          >
            <EllipsisOutlined style={{ rotate: '90deg', fontSize: 16 }} />
          </Button>
        </Dropdown>
      ) : (
        <>
          {items.map((item) => {
            return item.render ? (
              <div key={item.key}>{item.render()}</div>
            ) : (
              <Text key={item.key} onClick={onClick}>
                {item.label}
              </Text>
            );
          })}
        </>
      )}
    </Space>
  );
}
