import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  SyncOutlined,
  WarningFilled,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Space,
  Table,
  Typography,
} from 'antd';

import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url, COLORS } from '../../../../lib/constants';
import trackEvent from '../../../../trackingClient';
import { Domain } from './types';

interface DomainManagementContentProps {
  deployDocId: string;
}

const DomainManagementContent: React.FC<DomainManagementContentProps> = ({
  deployDocId,
}) => {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshingDomain, setRefreshingDomain] = useState<string | null>(null);
  const [isAddingDomain, setIsAddingDomain] = useState(false);

  const fetchDomains = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${api_url}/api/domains/${deployDocId}`, {
        headers: await getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch domains');
      }

      setDomains(data.data.domains || []);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deployDocId]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);
      // track event
      trackEvent('addDomain', {
        distinct_id: user.email,
        payload: JSON.stringify({
          documentId: deployDocId,
          domain: values.domain,
        }),
      });

      const response = await fetch(`${api_url}/api/domains/add`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          deployDocId,
          domain: values.domain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      form.resetFields();
      setIsAddingDomain(false);
      fetchDomains();
    } catch (error) {
      console.error('Failed to add domain:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add domain';
      form.setFields([
        {
          name: 'domain',
          errors: [errorMessage],
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshDomain = async (domainName: string) => {
    try {
      setRefreshingDomain(domainName);
      await fetchDomains();
    } catch (error) {
      console.error('Failed to refresh domain:', error);
      message.error('Failed to refresh domain');
    } finally {
      setRefreshingDomain(null);
    }
  };

  const handleRemoveDomain = async (domainName: string) => {
    try {
      const response = await fetch(
        `${api_url}/api/domains/${deployDocId}/${domainName}`,
        {
          method: 'DELETE',
          headers: await getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove domain');
      }

      setDomains((currentDomains) =>
        currentDomains.filter((d) => d.name !== domainName)
      );
    } catch (error) {
      console.error('Failed to remove domain:', error);
      setDomains((currentDomains) =>
        currentDomains.map((d) => {
          if (d.name === domainName) {
            return {
              ...d,
              removalError:
                error instanceof Error
                  ? error.message
                  : 'Failed to remove domain',
            };
          }
          return d;
        })
      );
    }
  };

  const renderDNSGuidance = (domain: Domain) => {
    const needsVerification = !domain.verified && domain.verificationRecord;
    const needsDNSConfig = domain.config?.misconfigured && domain.verified;

    if (!needsVerification && !needsDNSConfig) {
      return null;
    }

    const dnsColumns = [
      {
        title: t('domain.type'),
        dataIndex: 'type',
        key: 'type',
        width: '20%',
      },
      {
        title: t('domain.name'),
        dataIndex: 'name',
        key: 'name',
        width: '20%',
      },
      {
        title: t('domain.value'),
        dataIndex: 'value',
        key: 'value',
        width: '60%',
      },
    ];

    const dnsData = [];

    if (needsVerification) {
      dnsData.push({
        key: 'verification',
        type: domain.verificationRecord!.type,
        name: domain.verificationRecord!.name,
        value: domain.verificationRecord!.value,
      });
    } else if (needsDNSConfig) {
      dnsData.push({
        key: 'dns',
        type: domain.dnsRecord.type,
        name: domain.dnsRecord.name,
        value: domain.dnsRecord.value,
      });
    }

    return (
      <div style={{ marginTop: '12px' }}>
        <Alert
          type="warning"
          message=""
          description={
            <div>
              <Typography.Paragraph>
                {needsVerification
                  ? t('domain.verifyOwnership')
                  : t('domain.setupDns')}
              </Typography.Paragraph>
              <Table
                columns={dnsColumns}
                dataSource={dnsData}
                pagination={false}
                size="small"
                style={{ marginTop: '8px' }}
              />
              <Typography.Paragraph
                style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}
              >
                {needsVerification
                  ? t('domain.verificationComplete')
                  : t('domain.dnsPropagate')}
              </Typography.Paragraph>
            </div>
          }
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Typography.Paragraph style={{ color: '#666' }}>
          {t('domain.manageDesc')}
        </Typography.Paragraph>
        {!isAddingDomain && (
          <Button
            type="primary"
            onClick={() => setIsAddingDomain(true)}
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            {t('domain.addDomain')}
          </Button>
        )}
      </div>

      {isAddingDomain && (
        <Form form={form} layout="horizontal" onFinish={handleSubmit}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <Form.Item
              name="domain"
              style={{ flex: 1, marginBottom: '16px' }}
              rules={[
                { required: true, message: t('domain.pleaseEnterDomain') },
                {
                  type: 'string',
                  pattern:
                    /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
                  message: t('domain.validDomain'),
                },
              ]}
            >
              <Input placeholder={t('domain.enterDomain')} />
            </Form.Item>
            <Form.Item style={{ marginBottom: '16px' }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
                style={{ backgroundColor: COLORS.PRIMARY, marginRight: '8px' }}
              >
                {t('domain.addDomain')}
              </Button>
              <Button
                onClick={() => {
                  setIsAddingDomain(false);
                  form.resetFields();
                }}
              >
                {t('common.cancel')}
              </Button>
            </Form.Item>
          </div>
        </Form>
      )}

      <div style={{ marginTop: '24px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <SyncOutlined
              spin
              style={{ fontSize: '24px', color: COLORS.PRIMARY }}
            />
            <Typography.Text style={{ display: 'block', marginTop: '8px' }}>
              {t('domain.loadingDomains')}
            </Typography.Text>
          </div>
        ) : (
          domains.map((domain) => (
            <div
              key={domain.name}
              style={{
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #e8e8e8',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {domain.config?.misconfigured || !domain.verified ? (
                    <WarningFilled
                      style={{ color: '#ff4d4f', fontSize: '16px' }}
                    />
                  ) : (
                    <CheckCircleFilled
                      style={{ color: '#52c41a', fontSize: '16px' }}
                    />
                  )}
                  <Typography.Text strong>{domain.name}</Typography.Text>
                  {domain.redirect && (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: '12px' }}
                    >
                      {t('domain.redirectsTo')} {domain.redirect}
                    </Typography.Text>
                  )}
                  {!domain.config?.misconfigured &&
                    domain.verified &&
                    !domain.redirect && (
                      <Typography.Link
                        href={`https://${domain.name}`}
                        target="_blank"
                        style={{
                          fontSize: '16px',
                          color: COLORS.PRIMARY,
                          height: '24px',
                          width: '24px',
                          transform: 'rotate(45deg)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ArrowUpOutlined />
                      </Typography.Link>
                    )}
                </div>
                <Space>
                  <Button
                    type="text"
                    onClick={() => handleRefreshDomain(domain.name)}
                    icon={
                      <SyncOutlined spin={refreshingDomain === domain.name} />
                    }
                    loading={refreshingDomain === domain.name}
                  >
                    {t('domain.refresh')}
                  </Button>
                  <Button
                    type="text"
                    danger
                    onClick={() => handleRemoveDomain(domain.name)}
                    icon={<DeleteOutlined />}
                  >
                    {t('domain.remove')}
                  </Button>
                </Space>
              </div>
              {domain.removalError && (
                <Alert
                  type="error"
                  message={domain.removalError}
                  style={{ marginTop: '8px' }}
                  showIcon
                />
              )}
              {renderDNSGuidance(domain)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DomainManagementContent;
