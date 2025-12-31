import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url } from '../../../../lib/constants';
import { useLanguage } from '../../../../common/contexts/languageContext';

interface StripeProduct {
  priceId: string;
  productId?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  mode: 'subscription' | 'payment';
  interval?: 'month' | 'year';
  intervalCount?: number;
  trialDays?: number;
}

interface StripeProductsTabProps {
  stripeSecretKey: string;
  documentId: string;
  isReadOnly?: boolean;
  doc?: any;
  onClose?: () => void;
  onTriggerRedeployment?: () => void;
}

const StripeProductsTab: React.FC<StripeProductsTabProps> = ({
  stripeSecretKey,
  documentId,
  isReadOnly = false,
  doc,
  onClose,
  onTriggerRedeployment,
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const fetchStripeProducts = async () => {
    if (!stripeSecretKey.trim()) {
      message.warning(t('stripe.configureKeyFirst'));
      return;
    }

    setLoading(true);
    try {
      const headers = await getHeaders();
      const response = await fetch(`${api_url}/api/stripe/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stripeSecretKey,
          documentId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.errorMsg || t('stripe.fetchProductsFailed'));
      }

      setProducts(result.data.products || []);
    } catch (error: any) {
      console.error('Error fetching Stripe products:', error);
      message.error(error.message || t('stripe.fetchProductsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const triggerRedeployment = () => {
    // Show confirmation modal
    const confirmModal = Modal.confirm({
      title: t('apiKeys.redeploymentTitle'),
      content: t('apiKeys.redeploymentContent'),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      onOk: () => {
        // Close the confirmation modal immediately
        confirmModal.destroy();

        // Close the DocumentSettings modal immediately
        if (onClose) {
          onClose();
        }

        // Trigger redeployment in the parent component (streaming editor)
        if (onTriggerRedeployment) {
          onTriggerRedeployment();
        }
      },
    });
  };

  const handleSaveProducts = async () => {
    if (selectedProducts.length === 0) {
      message.warning(t('stripe.selectAtLeastOne'));
      return;
    }

    setSaving(true);
    try {
      const headers = await getHeaders();
      const selectedProductDetails = products.filter((p) =>
        selectedProducts.includes(p.priceId)
      );

      const response = await fetch(`${api_url}/api/stripe/update-products`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documentId,
          products: selectedProductDetails,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.errorMsg || t('stripe.updateProductsFailed'));
      }

      // 1) Refetch latest document to get fresh files from DB
      try {
        const headers = await getHeaders();
        const res = await fetch(`${api_url}/api/documents/${documentId}`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const latestDoc = json.data;
          // 2) Parse latest files and place into window for editor to pick up on redeploy
          // We avoid reshaping upper components; the deploy handler will read this snapshot.
          try {
            const contents = latestDoc?.contents;
            if (contents) {
              const parsed = JSON.parse(contents);
              if (parsed && Array.isArray(parsed.files)) {
                (window as any).__LATEST_FILES_FOR_REDEPLOY__ = parsed.files;
              }
            }
          } catch {}
        }
      } catch {}

      message.success(t('stripe.productsUpdated'));
    } catch (error: any) {
      console.error('Error updating products:', error);
      message.error(error.message || t('stripe.updateProductsFailed'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: t('stripe.columnSelect'),
      dataIndex: 'priceId',
      key: 'select',
      width: 80,
      render: (priceId: string) => (
        <Checkbox
          checked={selectedProducts.includes(priceId)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedProducts([...selectedProducts, priceId]);
            } else {
              setSelectedProducts(
                selectedProducts.filter((id) => id !== priceId)
              );
            }
          }}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: t('stripe.columnProductName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('stripe.columnPrice'),
      key: 'price',
      render: (record: StripeProduct) => {
        const formattedPrice = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: record.currency.toUpperCase(),
        }).format(record.price);

        if (record.mode === 'subscription' && record.interval) {
          return `${formattedPrice}/${record.interval}`;
        }
        return formattedPrice;
      },
    },
    {
      title: t('stripe.columnType'),
      dataIndex: 'mode',
      key: 'mode',
      render: (mode: string) =>
        mode === 'subscription'
          ? t('stripe.typeSubscription')
          : t('stripe.typeOneTime'),
    },
    {
      title: t('stripe.columnDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  useEffect(() => {
    if (stripeSecretKey) {
      fetchStripeProducts();
    } else {
      // Clear products and selections when switching to environment without key
      setProducts([]);
      setSelectedProducts([]);
    }
  }, [stripeSecretKey]);

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
        {t('stripe.products')}
      </h3>

      <Typography.Paragraph style={{ color: '#666', marginBottom: '24px' }}>
        {t('stripe.productsDesc')}
      </Typography.Paragraph>

      {!stripeSecretKey.trim() && (
        <Alert
          message={t('stripe.apiKeyRequired')}
          description={t('stripe.configureKeyFirst')}
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button
            type="primary"
            onClick={handleSaveProducts}
            loading={saving}
            disabled={selectedProducts.length === 0 || isReadOnly}
            style={{ marginRight: 12 }}
          >
            {saving
              ? t('stripe.saving')
              : t('stripe.saveSelectedProductsCount').replace(
                  '{count}',
                  String(selectedProducts.length)
                )}
          </Button>
          <Button
            type="default"
            onClick={fetchStripeProducts}
            loading={loading}
            disabled={!stripeSecretKey.trim()}
          >
            {loading ? t('stripe.loadingProducts') : t('stripe.fetchProducts')}
          </Button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : products.length > 0 ? (
          <>
            <Table
              columns={columns}
              dataSource={products}
              rowKey="priceId"
              pagination={false}
              scroll={{ y: 400 }}
            />
          </>
        ) : (
          stripeSecretKey.trim() && (
            <Alert
              message={t('stripe.noProductsFound')}
              description={t('stripe.noProductsDesc')}
              type="info"
              showIcon
            />
          )
        )}
      </Space>
    </div>
  );
};

export default StripeProductsTab;
