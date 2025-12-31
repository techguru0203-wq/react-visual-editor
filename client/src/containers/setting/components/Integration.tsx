import React from 'react';
import { BugOutlined, CloudOutlined, GithubOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../../../common/contexts/languageContext';
import {
  BitbucketConnectPath,
  GithubConnectPath,
  JiraAdminPath,
} from '../../nav/paths';

const { Title, Text } = Typography;

const Integration: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const integrationCards = [
    {
      title: t('integration.jiraIntegration'),
      icon: <BugOutlined style={{ fontSize: '24px', color: '#0052CC' }} />,
      description: t('integration.jiraDescription'),
      path: `/settings/${JiraAdminPath}`,
      color: '#0052CC',
    },
    {
      title: t('integration.githubConnect'),
      icon: <GithubOutlined style={{ fontSize: '24px', color: '#24292e' }} />,
      description: t('integration.githubDescription'),
      path: `/settings/${GithubConnectPath}`,
      color: '#24292e',
    },
    {
      title: t('integration.bitbucketConnect'),
      icon: <CloudOutlined style={{ fontSize: '24px', color: '#0052CC' }} />,
      description: t('integration.bitbucketDescription'),
      path: `/settings/${BitbucketConnectPath}`,
      color: '#0052CC',
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Row gutter={[32, 24]} justify="space-between">
        {integrationCards.map((card, index) => (
          <Col xs={24} sm={12} md={8} lg={7} key={index}>
            <Card
              hoverable
              style={{
                height: '200px',
                cursor: 'pointer',
                border: `2px solid ${card.color}20`,
                borderRadius: '12px',
                transition: 'all 0.3s ease',
              }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                height: '100%',
                padding: '24px',
              }}
              onClick={() => navigate(card.path)}
            >
              <div style={{ marginBottom: '16px' }}>{card.icon}</div>
              <Title
                level={4}
                style={{ margin: '0 0 8px 0', color: card.color }}
              >
                {card.title}
              </Title>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                {card.description}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Integration;
