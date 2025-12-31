import { useCallback, useEffect, useState } from 'react';
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
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';

import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url, COLORS } from '../../../../lib/constants';

interface DomainConfig {
  configuredBy: 'CNAME' | 'A' | 'http' | 'dns-01' | null;
  acceptedChallenges: string[];
  misconfigured: boolean;
  recommendedIps: string[];
  recommendedCname: string;
}

interface Domain {
  name: string;
  apexName: string;
  verified: boolean;
  createdAt: number;
  config: DomainConfig;
  isApex: boolean;
  dnsRecord: {
    type: string;
    name: string;
    value: string;
  };
  verificationRecord?: {
    type: string;
    name: string;
    value: string;
  } | null;
  redirect?: string;
  redirectStatusCode?: number;
  removalError?: string;
}

interface DomainManagementModalProps {
  onClose: () => void;
  deployDocId: string;
}

export function DomainManagementModal({
  onClose,
  deployDocId,
}: DomainManagementModalProps) {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshingDomain, setRefreshingDomain] = useState<string | null>(null);

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
      message.error(
        error instanceof Error ? error.message : 'Failed to fetch domains'
      );
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
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: '20%',
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: '20%',
      },
      {
        title: 'Value',
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
                  ? 'First, verify domain ownership by adding this DNS record to your DNS provider:'
                  : 'Now that ownership is verified, set up this DNS record to configure your domain:'}
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
                  ? 'Once the verification is completed and the domain is successfully configured, the TXT record can be removed.'
                  : 'Depending on your provider, it might take some time for the DNS records to propagate globally.'}
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
    <Modal
      title="Domains"
      open={true}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <div style={{ marginBottom: '24px' }}>
        <Typography.Paragraph style={{ color: '#666' }}>
          Manage the domains connected to your project.
        </Typography.Paragraph>
      </div>

      <Form form={form} layout="horizontal" onFinish={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Form.Item
            name="domain"
            style={{ flex: 1, marginBottom: '16px' }}
            rules={[
              { required: true, message: 'Please enter a domain' },
              {
                type: 'string',
                pattern:
                  /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
                message: 'Please enter a valid domain',
              },
            ]}
          >
            <Input placeholder="Enter your domain (e.g., example.com)" />
          </Form.Item>
          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              style={{ backgroundColor: COLORS.PRIMARY }}
            >
              Add Domain
            </Button>
          </Form.Item>
        </div>
      </Form>

      <div style={{ marginTop: '24px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <SyncOutlined
              spin
              style={{ fontSize: '24px', color: COLORS.PRIMARY }}
            />
            <Typography.Text style={{ display: 'block', marginTop: '8px' }}>
              Loading domains...
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
                      redirects to {domain.redirect}
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
                    Refresh
                  </Button>
                  <Button
                    type="text"
                    danger
                    onClick={() => handleRemoveDomain(domain.name)}
                    icon={<DeleteOutlined />}
                  >
                    Remove
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
    </Modal>
  );
}
